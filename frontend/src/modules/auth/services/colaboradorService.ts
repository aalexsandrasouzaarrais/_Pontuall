import { supabase } from '@/shared/services/supabase';
import { safeStorage } from '@/shared/utils/safeStorage';
import { Employee } from '@/types';

// Converte registro do banco BNE (TAB_Colaborador) para interface Employee do Frontend
export function mapBneToEmployee(row: any): Employee {
  return {
    id: row.Idf_Colaborador,
    name: row.Nme_Colaborador,
    role: row.Tpo_Cargo || 'Colaborador',
    department: row.Des_Departamento || 'Geral',
    avatar: row.Des_Avatar_Url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    email: row.Eml_Corporativo,
    phone: row.Num_Telefone || '(11) 99999-9999',
    standardHoursPerWeek: row.Num_Horas_Semanais || 40,
    registrationId: row.Cod_Matricula || '',
    companyId: row.Idf_Empresa,
    isMasterManager: row.Flg_Gestor_Master || false,
    managerIds: row.managerIds || []
  };
}

// Busca colaboradores do Supabase com suporte a filtragem por empresa e gestor
export async function getColaboradoresSupabase(filter?: { companyId?: string; gestorId?: string }): Promise<Employee[]> {
  try {
    let query = supabase
      .from('TAB_Colaborador')
      .select('*')
      .eq('Flg_Ativo', true)
      .neq('Tpo_Perfil', 'gestor');

    if (filter?.companyId) {
      query = query.eq('Idf_Empresa', filter.companyId);
    }

    const { data, error } = await query.order('Nme_Colaborador');

    if (error) {
      console.warn('Aviso ao buscar colaboradores do Supabase:', error.message);
      return [];
    }

    if (data && data.length > 0) {
      let result = data.map(mapBneToEmployee);

      // Se gestorId for especificado, realiza a filtragem pela tabela M:N TAB_Gestor_Colaborador
      if (filter?.gestorId) {
        const { data: vinculos } = await supabase
          .from('TAB_Gestor_Colaborador')
          .select('Idf_Colaborador')
          .eq('Idf_Gestor', filter.gestorId);

        if (vinculos) {
          const idsPermitidos = new Set(vinculos.map((v: any) => v.Idf_Colaborador));
          result = result.filter(emp => idsPermitidos.has(emp.id));
        }
      }

      return result.filter(emp => !emp.isMasterManager);
    }
    return [];
  } catch (err: any) {
    console.error('Erro na chamada Supabase:', err.message);
    return [];
  }
}

// Salva um novo colaborador diretamente na tabela TAB_Colaborador e estabelece o vínculo M:N em TAB_Gestor_Colaborador
export async function createColaboradorSupabase(emp: Employee, creatorGestorId?: string): Promise<Employee> {
  const matricula = emp.registrationId || `PNT-${Math.floor(1000 + Math.random() * 9000)}`;
  const payload = {
    Cod_Matricula: matricula,
    Nme_Colaborador: emp.name,
    Eml_Corporativo: emp.email,
    Des_Senha_Hash: matricula, // ID como senha provisória
    Tpo_Perfil: 'colaborador',
    Tpo_Cargo: emp.role,
    Des_Departamento: emp.department,
    Des_Avatar_Url: emp.avatar,
    Num_Telefone: emp.phone,
    Num_Horas_Semanais: emp.standardHoursPerWeek || 40,
    Idf_Empresa: emp.companyId || null,
    Flg_Ativo: true
  };

  const { data: novoColaborador, error } = await supabase
    .from('TAB_Colaborador')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('Erro ao inserir colaborador no Supabase:', error.message);
    throw new Error(error.message);
  }

  // Estabelece os vínculos de gestores (M:N) na tabela TAB_Gestor_Colaborador
  const gestoresParaVincular = new Set<string>();
  if (creatorGestorId) gestoresParaVincular.add(creatorGestorId);
  if (emp.managerIds) emp.managerIds.forEach(id => gestoresParaVincular.add(id));

  if (gestoresParaVincular.size > 0) {
    const vinculosPayload = Array.from(gestoresParaVincular).map((gestorId, index) => ({
      Idf_Gestor: gestorId,
      Idf_Colaborador: novoColaborador.Idf_Colaborador,
      Idf_Empresa: emp.companyId || null,
      Flg_Gestor_Principal: index === 0
    }));

    await supabase.from('TAB_Gestor_Colaborador').insert(vinculosPayload);
  }

  const mapped = mapBneToEmployee(novoColaborador);
  mapped.managerIds = Array.from(gestoresParaVincular);
  return mapped;
}

// Salva um novo gestor no Supabase com suporte a CNPJ e Multi-Empresa
export async function createGestorSupabase(gestorData: {
  name: string;
  email: string;
  password: string;
  cnpj?: string;
  role?: string;
  department?: string;
  phone?: string;
}): Promise<Employee> {
  const cleanEmail = gestorData.email.trim().toLowerCase();
  const rawCnpj = gestorData.cnpj ? gestorData.cnpj.replace(/\D/g, '') : '';
  let companyId: string | null = null;
  let isMasterManager = false;
  let companyCnpj: string | undefined = undefined;

  // 1. Processa a Empresa por CNPJ
  if (rawCnpj.length === 14) {
    companyCnpj = rawCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

    try {
      const { data: empExistente } = await supabase
        .from('TAB_Empresa')
        .select('Idf_Empresa')
        .eq('Num_CNPJ', companyCnpj)
        .maybeSingle();

      if (empExistente) {
        companyId = empExistente.Idf_Empresa;
        isMasterManager = false; // Empresa já existia -> gestor secundário
      } else {
        const { data: novaEmp, error: empErr } = await supabase
          .from('TAB_Empresa')
          .insert({
            Num_CNPJ: companyCnpj,
            Nme_Razao_Social: `Empresa ${companyCnpj}`,
            Nme_Fantasia: `Organização ${companyCnpj}`,
            Flg_Ativa: true
          })
          .select()
          .single();

        if (!empErr && novaEmp) {
          companyId = novaEmp.Idf_Empresa;
          isMasterManager = true; // 1º Gestor cadastrado com este CNPJ -> Master/RH!
        }
      }
    } catch (empException) {
      console.warn('Alerta ao processar tabela TAB_Empresa no Supabase:', empException);
    }
  }

  const matricula = `GST-${Math.floor(1000 + Math.random() * 9000)}`;
  const payload = {
    Cod_Matricula: matricula,
    Nme_Colaborador: gestorData.name.trim(),
    Eml_Corporativo: cleanEmail,
    Des_Senha_Hash: gestorData.password,
    Tpo_Perfil: 'gestor',
    Tpo_Cargo: gestorData.role?.trim() || 'Gestor Geral',
    Des_Departamento: gestorData.department?.trim() || 'Gestão de Pessoas & Operações',
    Des_Avatar_Url: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80',
    Num_Telefone: gestorData.phone?.trim() || '(11) 98765-4321',
    Num_Horas_Semanais: 44,
    Idf_Empresa: companyId,
    Flg_Gestor_Master: isMasterManager,
    Flg_Ativo: true
  };

  const { data, error } = await supabase
    .from('TAB_Colaborador')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('Erro ao inserir gestor no Supabase:', error.message);
    throw new Error(error.message);
  }

  const emp = mapBneToEmployee(data);
  emp.companyId = companyId || undefined;
  emp.companyCnpj = companyCnpj;
  emp.isMasterManager = isMasterManager;
  return emp;
}

// Vincula um Colaborador a um Gestor na tabela M:N TAB_Gestor_Colaborador
export async function vincularGestorColaboradorSupabase(
  gestorId: string,
  colaboradorId: string,
  empresaId?: string,
  ePrincipal: boolean = true
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('TAB_Gestor_Colaborador')
      .upsert({
        Idf_Gestor: gestorId,
        Idf_Colaborador: colaboradorId,
        Idf_Empresa: empresaId || null,
        Flg_Gestor_Principal: ePrincipal
      }, { onConflict: 'Idf_Gestor,Idf_Colaborador' });

    if (error) {
      console.warn('Erro ao vincular na tabela M:N TAB_Gestor_Colaborador:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('Erro ao vincular gestor-colaborador:', err.message);
    return false;
  }
}

// Atualiza a foto de perfil do colaborador ou gestor na tabela TAB_Colaborador
export async function updateColaboradorAvatarSupabase(employeeId: string, email: string, avatarUrl: string): Promise<boolean> {
  try {
    let query = supabase.from('TAB_Colaborador').update({ Des_Avatar_Url: avatarUrl });

    if (employeeId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId)) {
      query = query.eq('Idf_Colaborador', employeeId);
    } else if (email) {
      query = query.eq('Eml_Corporativo', email.toLowerCase());
    } else {
      return false;
    }

    const { error } = await query;
    if (error) {
      console.warn('Aviso ao atualizar avatar no Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('Erro ao atualizar avatar:', err.message);
    return false;
  }
}

// Sincroniza usuário autenticado via Google Workspace com a tabela TAB_Colaborador.
// REGRA: Apenas contas previamente cadastradas no sistema podem acessar!
export async function syncGoogleUserWithSupabase(googleUser: {
  email: string;
  name: string;
  picture?: string;
  roleHint?: 'manager' | 'employee';
}): Promise<Employee | null> {
  const email = googleUser.email.toLowerCase().trim();

  try {
    // 1. Verifica se a conta já existe na tabela TAB_Colaborador e está ativa
    const { data: existing, error } = await supabase
      .from('TAB_Colaborador')
      .select('*')
      .or(`Eml_Corporativo.ilike.${email},Eml_Secundario.ilike.${email}`)
      .eq('Flg_Ativo', true)
      .maybeSingle();

    if (error) {
      console.warn('Aviso ao consultar usuário Google no Supabase:', error.message);
    }

    // Se a conta já existe previamente no sistema, permite o acesso
    if (existing) {
      // Atualiza foto de perfil do Google caso não tenha uma foto personalizada
      if (googleUser.picture && (!existing.Des_Avatar_Url || existing.Des_Avatar_Url.includes('unsplash'))) {
        try {
          await supabase
            .from('TAB_Colaborador')
            .update({ Des_Avatar_Url: googleUser.picture })
            .eq('Idf_Colaborador', existing.Idf_Colaborador);
          existing.Des_Avatar_Url = googleUser.picture;
        } catch {}
      }
      return mapBneToEmployee(existing);
    }

    // Se NÃO estiver previamente cadastrada, rejeita o acesso (não cria novo colaborador)
    console.warn(`[Google Workspace] Acesso negado: o e-mail ${email} não está previamente cadastrado.`);
    return null;
  } catch (err: any) {
    console.error('Erro ao verificar usuário Google no Supabase:', err.message);
    return null;
  }
}

// Inativa ou Desvincula um colaborador no Supabase
export async function deactivateColaboradorSupabase(
  employeeId: string,
  gestorId?: string,
  isMasterManager: boolean = true
): Promise<boolean> {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId);
    if (!isUuid) return true;

    if (isMasterManager) {
      // Gestor Master: Inativa o colaborador na TAB_Colaborador (Soft Delete)
      const { error } = await supabase
        .from('TAB_Colaborador')
        .update({ Flg_Ativo: false })
        .eq('Idf_Colaborador', employeeId);

      if (error) {
        console.warn('Erro ao inativar colaborador no Supabase:', error.message);
        return false;
      }
    } else if (gestorId) {
      // Gestor de Equipe: Remove o vínculo na tabela M:N TAB_Gestor_Colaborador
      const { error } = await supabase
        .from('TAB_Gestor_Colaborador')
        .delete()
        .eq('Idf_Gestor', gestorId)
        .eq('Idf_Colaborador', employeeId);

      if (error) {
        console.warn('Erro ao remover vínculo do colaborador:', error.message);
        return false;
      }
    }
    return true;
  } catch (err: any) {
    console.error('Erro ao inativar/desvincular colaborador:', err.message);
    return false;
  }
}

// Atualiza dados cadastrais de um colaborador no Supabase
export async function updateColaboradorSupabase(emp: Partial<Employee> & { id: string }): Promise<boolean> {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(emp.id);
    if (!isUuid) return true;

    const payload: any = {};
    if (emp.name) payload.Nme_Colaborador = emp.name;
    if (emp.role) payload.Tpo_Cargo = emp.role;
    if (emp.department) payload.Des_Departamento = emp.department;
    if (emp.phone) payload.Num_Telefone = emp.phone;
    if (emp.standardHoursPerWeek) payload.Num_Horas_Semanais = emp.standardHoursPerWeek;

    const { error } = await supabase
      .from('TAB_Colaborador')
      .update(payload)
      .eq('Idf_Colaborador', emp.id);

    if (error) {
      console.warn('Erro ao atualizar colaborador no Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('Erro ao atualizar colaborador:', err.message);
    return false;
  }
}

// Atualiza a senha definitiva do colaborador no Supabase ou LocalStorage
export async function updateColaboradorPasswordSupabase(identifier: string, novaSenha: string): Promise<boolean> {
  try {
    if (!identifier || !identifier.trim()) return false;

    const rawInput = identifier.trim();
    const cleanNoSpace = rawInput.replace(/\s+/g, '');
    const norm = rawInput.toLowerCase();
    const normNoSpace = cleanNoSpace.toLowerCase();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawInput);

    let updatedInSupabase = false;

    // 1. Tenta buscar e atualizar no Supabase
    try {
      let query = supabase.from('TAB_Colaborador').select('*');

      if (isUuid) {
        query = query.or(`Idf_Colaborador.eq.${rawInput},Cod_Matricula.ilike.%${rawInput}%,Eml_Corporativo.ilike.%${rawInput}%`);
      } else {
        query = query.or(`Cod_Matricula.ilike.%${rawInput}%,Cod_Matricula.ilike.%${cleanNoSpace}%,Eml_Corporativo.ilike.%${rawInput}%`);
      }

      const { data: list, error: findError } = await query.limit(1);

      if (!findError && list && list.length > 0) {
        const usuario = list[0];
        const { error: updateError } = await supabase
          .from('TAB_Colaborador')
          .update({ Des_Senha_Hash: novaSenha })
          .eq('Idf_Colaborador', usuario.Idf_Colaborador);

        if (!updateError) {
          updatedInSupabase = true;
        }
      }
    } catch (supErr) {
      console.warn('Aviso ao atualizar senha no Supabase:', supErr);
    }

    // 2. Atualiza no registro local (safeStorage - pontual_registered_users) se existir
    let updatedInLocal = false;
    try {
      const localUsersStr = safeStorage.getItem('pontual_registered_users');
      if (localUsersStr) {
        const localUsers = JSON.parse(localUsersStr);
        let foundIndex = localUsers.findIndex((u: any) => {
          const mat = (u.Cod_Matricula || u.matricula || '').toLowerCase();
          const eml = (u.Eml_Corporativo || u.email || '').toLowerCase();
          const id = (u.Idf_Colaborador || u.id || '').toLowerCase();
          return mat.includes(norm) || mat.includes(normNoSpace) || eml.includes(norm) || id.includes(norm);
        });

        if (foundIndex >= 0) {
          localUsers[foundIndex].Des_Senha_Hash = novaSenha;
          localUsers[foundIndex].senha = novaSenha;
          safeStorage.setItem('pontual_registered_users', JSON.stringify(localUsers));
          updatedInLocal = true;
        }
      }
    } catch (localErr) {
      console.warn('Aviso ao atualizar senha em local storage:', localErr);
    }

    // Retorna true se atualizou no Supabase ou no localStorage local
    if (updatedInSupabase || updatedInLocal) {
      return true;
    }

    // 3. Fallback: Se o identificador tiver pelo menos 3 caracteres (ex: PNT-1635),
    // salva o registro de senha atualizada em local storage para permitir o login imediato
    if (rawInput.length >= 3) {
      try {
        const localUsersStr = safeStorage.getItem('pontual_registered_users');
        const localUsers = localUsersStr ? JSON.parse(localUsersStr) : [];
        localUsers.push({
          Cod_Matricula: rawInput.toUpperCase(),
          Nme_Colaborador: 'Colaborador',
          Eml_Corporativo: `${normNoSpace}@pontual.com.br`,
          Des_Senha_Hash: novaSenha,
          Tpo_Perfil: 'colaborador',
          Flg_Ativo: true
        });
        safeStorage.setItem('pontual_registered_users', JSON.stringify(localUsers));
        return true;
      } catch {}
    }

    return false;
  } catch (err: any) {
    console.warn('Erro ao atualizar senha:', err?.message || err);
    return false;
  }
}

