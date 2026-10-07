import { supabase } from '@/shared/services/supabase';
import { Employee } from '@/types';
import { safeStorage } from '@/shared/utils/safeStorage';

// Converte registro do banco BNE (TAB_Colaborador) para interface Employee do Frontend
export function mapBneToEmployee(row: any): Employee {
  const isRh = row.Tpo_Perfil === 'rh' || row.Flg_Gestor_Master === true;
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
    isRh: isRh,
    roleType: row.Tpo_Perfil === 'rh' ? 'rh' : row.Tpo_Perfil === 'gestor' ? 'gestor' : 'colaborador',
    managerIds: row.managerIds || []
  };
}

// IDs do banco são UUID; IDs locais/demonstração (ex: 'mgr-1', 'emp-PNT-1234') não podem ir para colunas UUID.
// Regex sem checagem de versão para aceitar também os UUIDs fixos do seed (ex: a0000000-0000-0000-0000-000000000001).
export function isUuid(id?: string | null): boolean {
  return !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// Carrega o mapa colaborador -> [gestores] a partir da tabela M:N TAB_Gestor_Colaborador.
// Sem isso, após o F5 todos os colaboradores voltavam com managerIds vazio e sumiam da visão do gestor.
async function getManagerLinksMap(colaboradorIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  const ids = colaboradorIds.filter(isUuid);
  if (ids.length === 0) return map;

  const { data, error } = await supabase
    .from('TAB_Gestor_Colaborador')
    .select('Idf_Gestor, Idf_Colaborador')
    .in('Idf_Colaborador', ids);

  if (error) {
    console.warn('Aviso ao buscar vínculos em TAB_Gestor_Colaborador:', error.message);
    return map;
  }

  (data || []).forEach((v: any) => {
    const list = map.get(v.Idf_Colaborador) || [];
    if (!list.includes(v.Idf_Gestor)) list.push(v.Idf_Gestor);
    map.set(v.Idf_Colaborador, list);
  });
  return map;
}

// Grava vínculos gestor -> colaborador. Se a tabela não tiver as colunas opcionais
// (Idf_Empresa / Flg_Gestor_Principal, ausentes no schema_bne.sql original), repete com o payload mínimo.
async function saveGestorLinks(colaboradorId: string, gestorIds: string[], companyId?: string | null): Promise<boolean> {
  const validGestores = Array.from(new Set(gestorIds.filter(id => isUuid(id) && id !== colaboradorId)));
  if (!isUuid(colaboradorId) || validGestores.length === 0) return true;

  const fullPayload = validGestores.map((gestorId, index) => ({
    Idf_Gestor: gestorId,
    Idf_Colaborador: colaboradorId,
    Idf_Empresa: isUuid(companyId) ? companyId : null,
    Flg_Gestor_Principal: index === 0
  }));

  const { error } = await supabase
    .from('TAB_Gestor_Colaborador')
    .upsert(fullPayload, { onConflict: 'Idf_Gestor,Idf_Colaborador' });
  if (!error) return true;

  console.warn('Vínculo completo falhou, tentando payload mínimo:', error.message);
  const minimalPayload = validGestores.map(gestorId => ({ Idf_Gestor: gestorId, Idf_Colaborador: colaboradorId }));
  const { error: minimalError } = await supabase
    .from('TAB_Gestor_Colaborador')
    .upsert(minimalPayload, { onConflict: 'Idf_Gestor,Idf_Colaborador' });

  if (minimalError) {
    console.error('Erro ao gravar vínculo gestor-colaborador:', minimalError.message);
    return false;
  }
  return true;
}

// Descobre a empresa de um colaborador/gestor diretamente no banco
async function getEmpresaDoColaborador(colaboradorId?: string): Promise<string | null> {
  if (!isUuid(colaboradorId)) return null;
  const { data } = await supabase
    .from('TAB_Colaborador')
    .select('Idf_Empresa')
    .eq('Idf_Colaborador', colaboradorId)
    .maybeSingle();
  return data?.Idf_Empresa || null;
}

// Busca um colaborador pelo ID (usado para reidratar a sessão após F5)
export async function getColaboradorByIdSupabase(colaboradorId: string): Promise<Employee | null> {
  if (!isUuid(colaboradorId)) return null;
  try {
    const { data, error } = await supabase
      .from('TAB_Colaborador')
      .select('*')
      .eq('Idf_Colaborador', colaboradorId)
      .eq('Flg_Ativo', true)
      .maybeSingle();
    if (error || !data) return null;
    const links = await getManagerLinksMap([colaboradorId]);
    const emp = mapBneToEmployee(data);
    emp.managerIds = links.get(colaboradorId) || [];
    return emp;
  } catch {
    return null;
  }
}

// Busca colaboradores do Supabase com suporte a filtragem por empresa e gestor
export async function getColaboradoresSupabase(filter?: { companyId?: string; gestorId?: string }): Promise<Employee[]> {
  try {
    let query = supabase
      .from('TAB_Colaborador')
      .select('*')
      .eq('Flg_Ativo', true);

    if (filter?.companyId) {
      query = query.eq('Idf_Empresa', filter.companyId);
    }

    const { data, error } = await query.order('Nme_Colaborador');

    if (error) {
      console.warn('Aviso ao buscar colaboradores do Supabase:', error.message);
      return [];
    }

    let rows: any[] = data || [];

    // Auto-correção: colaboradores gravados sem Idf_Empresa, mas vinculados a gestores desta empresa,
    // são incluídos e recebem a empresa (antes eles "sumiam" no F5 por causa do filtro por empresa).
    if (filter?.companyId && isUuid(filter.companyId) && rows.length > 0) {
      const companyMemberIds = rows.map(r => r.Idf_Colaborador);
      const { data: links } = await supabase
        .from('TAB_Gestor_Colaborador')
        .select('Idf_Colaborador')
        .in('Idf_Gestor', companyMemberIds);

      const known = new Set(companyMemberIds);
      const candidateIds = Array.from(new Set((links || []).map((l: any) => l.Idf_Colaborador)))
        .filter((id: any) => !known.has(id)) as string[];

      if (candidateIds.length > 0) {
        const { data: orphans } = await supabase
          .from('TAB_Colaborador')
          .select('*')
          .in('Idf_Colaborador', candidateIds)
          .is('Idf_Empresa', null)
          .eq('Flg_Ativo', true);

        if (orphans && orphans.length > 0) {
          rows = [...rows, ...orphans].sort((a, b) =>
            String(a.Nme_Colaborador || '').localeCompare(String(b.Nme_Colaborador || ''), 'pt-BR')
          );
          const { error: healError } = await supabase
            .from('TAB_Colaborador')
            .update({ Idf_Empresa: filter.companyId })
            .in('Idf_Colaborador', orphans.map((o: any) => o.Idf_Colaborador))
            .is('Idf_Empresa', null);
          if (healError) console.warn('Aviso ao corrigir empresa de colaboradores órfãos:', healError.message);
        }
      }
    }

    if (rows.length === 0) return [];

    const managerMap = await getManagerLinksMap(rows.map(r => r.Idf_Colaborador));
    let result = rows.map(row => {
      const emp = mapBneToEmployee(row);
      emp.managerIds = managerMap.get(row.Idf_Colaborador) || [];
      return emp;
    });

    // Gestor de setor (não-RH): vê a si mesmo + colaboradores vinculados a ele
    if (filter?.gestorId) {
      const gestorId = filter.gestorId;
      result = result.filter(emp => emp.id === gestorId || (emp.managerIds || []).includes(gestorId));
    }

    return result;
  } catch (err: any) {
    console.error('Erro na chamada Supabase:', err.message);
    return [];
  }
}

// Salva um novo colaborador diretamente na tabela TAB_Colaborador e estabelece o vínculo M:N em TAB_Gestor_Colaborador
export async function createColaboradorSupabase(emp: Employee, creatorGestorId?: string): Promise<Employee> {
  const matricula = emp.registrationId || `PNT-${Math.floor(1000 + Math.random() * 9000)}`;

  // A empresa do novo cadastro é sempre a do gestor/RH que está cadastrando.
  // Se o objeto não trouxer uma empresa válida, busca no banco a empresa do criador.
  let companyId: string | null = isUuid(emp.companyId) ? emp.companyId! : null;
  if (!companyId) {
    companyId = await getEmpresaDoColaborador(creatorGestorId);
  }

  const perfil = emp.roleType === 'rh' ? 'rh' : emp.roleType === 'gestor' ? 'gestor' : (emp.isRh ? 'rh' : 'colaborador');
  const payload = {
    Cod_Matricula: matricula,
    Nme_Colaborador: emp.name,
    Eml_Corporativo: emp.email,
    Des_Senha_Hash: matricula, // ID como senha provisória
    Tpo_Perfil: perfil,
    Tpo_Cargo: emp.role,
    Des_Departamento: emp.department,
    Des_Avatar_Url: emp.avatar,
    Num_Telefone: emp.phone,
    Num_Horas_Semanais: emp.standardHoursPerWeek || 40,
    Idf_Empresa: companyId,
    Flg_Gestor_Master: perfil === 'rh',
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
  const gestoresParaVincular: string[] = [];
  if (creatorGestorId) gestoresParaVincular.push(creatorGestorId);
  (emp.managerIds || []).forEach(id => { if (!gestoresParaVincular.includes(id)) gestoresParaVincular.push(id); });
  const gestoresValidos = gestoresParaVincular.filter(id => isUuid(id) && id !== novoColaborador.Idf_Colaborador);

  await saveGestorLinks(novoColaborador.Idf_Colaborador, gestoresValidos, companyId);

  const mapped = mapBneToEmployee(novoColaborador);
  mapped.managerIds = gestoresValidos;
  return mapped;
}

// Salva um novo gestor no Supabase com suporte a CNPJ e Multi-Empresa
export async function createGestorSupabase(gestorData: {
  name: string;
  email: string;
  password: string;
  cnpj?: string;
  companyName?: string;
  role?: string;
  department?: string;
  phone?: string;
  isRh?: boolean;
}): Promise<Employee> {
  const cleanEmail = gestorData.email.trim().toLowerCase();
  const rawCnpj = gestorData.cnpj ? gestorData.cnpj.replace(/\D/g, '') : '';
  let companyId: string | null = null;
  let isMasterManager = gestorData.isRh ?? false;
  let companyCnpj: string | undefined = undefined;

  // 1. Processa a Empresa na TAB_Empresa
  const companyNameVal = gestorData.companyName?.trim();
  if (companyNameVal || rawCnpj.length > 0) {
    if (rawCnpj.length === 14) {
      companyCnpj = rawCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    } else if (rawCnpj.length > 0) {
      companyCnpj = rawCnpj;
    } else {
      companyCnpj = `00.000.000/0001-${Math.floor(10 + Math.random() * 89)}`;
    }

    try {
      let empExistente: any = null;
      if (companyCnpj && companyCnpj !== '00.000.000/0001-00') {
        const { data } = await supabase
          .from('TAB_Empresa')
          .select('Idf_Empresa')
          .eq('Num_CNPJ', companyCnpj)
          .maybeSingle();
        empExistente = data;
      }

      if (empExistente) {
        companyId = empExistente.Idf_Empresa;
      } else {
        const finalName = companyNameVal || `Empresa ${companyCnpj}`;
        const { data: novaEmp, error: empErr } = await supabase
          .from('TAB_Empresa')
          .insert({
            Num_CNPJ: companyCnpj,
            Nme_Fantasia: finalName,
            Nme_Razao_Social: finalName,
            Flg_Ativa: true
          })
          .select()
          .single();

        if (empErr) {
          console.error('Erro ao inserir empresa em TAB_Empresa:', empErr.message);
        } else if (novaEmp) {
          companyId = novaEmp.Idf_Empresa;
          isMasterManager = true; // 1º Gestor cadastrado com esta empresa -> Master/RH!
        }
      }
    } catch (empException) {
      console.warn('Alerta ao processar tabela TAB_Empresa no Supabase:', empException);
    }
  }

  const isRhFinal = gestorData.isRh || isMasterManager || (gestorData.role && gestorData.role.toLowerCase().includes('rh'));
  const matricula = `GST-${Math.floor(1000 + Math.random() * 9000)}`;
  const payload = {
    Cod_Matricula: matricula,
    Nme_Colaborador: gestorData.name.trim(),
    Eml_Corporativo: cleanEmail,
    Des_Senha_Hash: gestorData.password,
    Tpo_Perfil: isRhFinal ? 'rh' : 'gestor',
    Tpo_Cargo: gestorData.role?.trim() || (isRhFinal ? 'Gerente de RH & Administração Geral' : 'Gestor de Setor'),
    Des_Departamento: gestorData.department?.trim() || (isRhFinal ? 'Recursos Humanos & Gestão Geral' : 'Gestão de Pessoas & Operações'),
    Des_Avatar_Url: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80',
    Num_Telefone: gestorData.phone?.trim() || '(11) 98765-4321',
    Num_Horas_Semanais: 44,
    Idf_Empresa: companyId,
    Flg_Gestor_Master: isRhFinal,
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
  emp.isMasterManager = isRhFinal;
  emp.isRh = isRhFinal;
  emp.roleType = isRhFinal ? 'rh' : 'gestor';
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
    if (!isUuid(emp.id)) return true;

    const payload: any = {};
    if (emp.name) payload.Nme_Colaborador = emp.name;
    if (emp.role) payload.Tpo_Cargo = emp.role;
    if (emp.department) payload.Des_Departamento = emp.department;
    if (emp.phone) payload.Num_Telefone = emp.phone;
    if (emp.standardHoursPerWeek) payload.Num_Horas_Semanais = emp.standardHoursPerWeek;
    if (emp.roleType) {
      payload.Tpo_Perfil = emp.roleType;
      payload.Flg_Gestor_Master = emp.roleType === 'rh';
    }

    const { error } = await supabase
      .from('TAB_Colaborador')
      .update(payload)
      .eq('Idf_Colaborador', emp.id);

    if (error) {
      console.warn('Erro ao atualizar colaborador no Supabase:', error.message);
      return false;
    }

    // Sincroniza o "Gestor Responsável" escolhido na edição com a tabela M:N
    if (emp.managerIds !== undefined) {
      const novosGestores = emp.managerIds.filter(id => isUuid(id) && id !== emp.id);
      const { error: delError } = await supabase
        .from('TAB_Gestor_Colaborador')
        .delete()
        .eq('Idf_Colaborador', emp.id);
      if (delError) {
        console.warn('Erro ao limpar vínculos antigos do colaborador:', delError.message);
        return false;
      }
      const companyId = isUuid(emp.companyId) ? emp.companyId! : await getEmpresaDoColaborador(emp.id);
      return await saveGestorLinks(emp.id, novosGestores, companyId);
    }
    return true;
  } catch (err: any) {
    console.error('Erro ao atualizar colaborador:', err.message);
    return false;
  }
}

// Atualiza a senha definitiva do colaborador no Supabase (substituindo a temporária)
export async function updateColaboradorPasswordSupabase(identifier: string, novaSenha: string): Promise<boolean> {
  try {
    const cleanId = identifier.trim();
    if (!cleanId) return false;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId);
    let dbSuccess = false;

    if (isUuid) {
      const { error } = await supabase
        .from('TAB_Colaborador')
        .update({ Des_Senha_Hash: novaSenha })
        .eq('Idf_Colaborador', cleanId);
      dbSuccess = !error;
      if (error) console.warn('Erro ao atualizar senha por UUID no Supabase:', error.message);
    } else {
      const cleanNoSpace = cleanId.replace(/\s+/g, '');
      const { error } = await supabase
        .from('TAB_Colaborador')
        .update({ Des_Senha_Hash: novaSenha })
        .or(`Cod_Matricula.ilike.%${cleanNoSpace}%,Eml_Corporativo.ilike.%${cleanId}%`);
      dbSuccess = !error;
      if (error) console.warn('Erro ao atualizar senha por Matrícula/Email no Supabase:', error.message);
    }

    // Atualiza também no localStorage/safeStorage para suporte offline/local fallback
    try {
      const localUsersStr = safeStorage.getItem('pontual_registered_users');
      if (localUsersStr) {
        const localUsers = JSON.parse(localUsersStr);
        let updatedAny = false;
        const updated = localUsers.map((u: any) => {
          const mat = (u.Cod_Matricula || u.matricula || '').toLowerCase();
          const eml = (u.Eml_Corporativo || u.email || '').toLowerCase();
          if (mat.includes(cleanId.toLowerCase()) || eml.includes(cleanId.toLowerCase())) {
            updatedAny = true;
            return { ...u, Des_Senha_Hash: novaSenha, password: novaSenha };
          }
          return u;
        });
        if (updatedAny) {
          safeStorage.setItem('pontual_registered_users', JSON.stringify(updated));
        }
      }
    } catch {}

    return dbSuccess || true;
  } catch (err: any) {
    console.warn('Erro ao atualizar senha no Supabase:', err?.message || err);
    return true;
  }
}

