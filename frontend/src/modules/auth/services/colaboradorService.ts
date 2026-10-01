import { supabase } from '@/shared/services/supabase';
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
  };
}

// Busca todos os colaboradores da tabela TAB_Colaborador no Supabase
export async function getColaboradoresSupabase(): Promise<Employee[]> {
  try {
    const { data, error } = await supabase
      .from('TAB_Colaborador')
      .select('*')
      .eq('Flg_Ativo', true)
      .order('Nme_Colaborador');

    if (error) {
      console.warn('Aviso ao buscar colaboradores do Supabase:', error.message);
      return [];
    }

    if (data && data.length > 0) {
      return data.map(mapBneToEmployee);
    }
    return [];
  } catch (err: any) {
    console.error('Erro na chamada Supabase:', err.message);
    return [];
  }
}

// Salva um novo colaborador diretamente na tabela TAB_Colaborador no Supabase
export async function createColaboradorSupabase(emp: Employee): Promise<Employee> {
  const matricula = emp.registrationId || `PNT-${Math.floor(1000 + Math.random() * 9000)}`;
  const payload = {
    Cod_Matricula: matricula,
    Nme_Colaborador: emp.name,
    Eml_Corporativo: emp.email,
    Des_Senha_Hash: matricula, // O ID é a senha provisória de primeiro acesso!
    Tpo_Perfil: 'colaborador',
    Tpo_Cargo: emp.role,
    Des_Departamento: emp.department,
    Des_Avatar_Url: emp.avatar,
    Num_Telefone: emp.phone,
    Num_Horas_Semanais: emp.standardHoursPerWeek || 40,
    Flg_Ativo: true
  };

  const { data, error } = await supabase
    .from('TAB_Colaborador')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('Erro ao inserir colaborador no Supabase:', error.message);
    throw new Error(error.message);
  }

  return mapBneToEmployee(data);
}

// Salva um novo gestor diretamente na tabela TAB_Colaborador no Supabase
export async function createGestorSupabase(gestorData: {
  name: string;
  email: string;
  password: string;
  cnpj?: string;
  role?: string;
  department?: string;
  phone?: string;
}): Promise<Employee> {
  const matricula = `GST-${Math.floor(1000 + Math.random() * 9000)}`;
  const payload = {
    Cod_Matricula: matricula,
    Nme_Colaborador: gestorData.name.trim(),
    Eml_Corporativo: gestorData.email.trim().toLowerCase(),
    Des_Senha_Hash: gestorData.password,
    Tpo_Perfil: 'gestor',
    Tpo_Cargo: gestorData.role?.trim() || 'Gestor Geral',
    Des_Departamento: gestorData.department?.trim() || 'Gestão de Pessoas & Operações',
    Des_Avatar_Url: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80',
    Num_Telefone: gestorData.phone?.trim() || '(11) 98765-4321',
    Num_Horas_Semanais: 44,
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

  return mapBneToEmployee(data);
}

// Atualiza a foto de perfil do colaborador ou gestor na tabela TAB_Colaborador
export async function updateColaboradorAvatarSupabase(employeeId: string, email: string, avatarUrl: string): Promise<boolean> {
  try {
    let query = supabase.from('TAB_Colaborador').update({ Des_Avatar_Url: avatarUrl });

    // Tenta atualizar pelo Idf_Colaborador (se for UUID válido) ou pelo Eml_Corporativo
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

// Sincroniza usuário autenticado via Google Workspace com a tabela TAB_Colaborador
export async function syncGoogleUserWithSupabase(googleUser: {
  email: string;
  name: string;
  picture?: string;
  roleHint?: 'manager' | 'employee';
}): Promise<Employee> {
  const email = googleUser.email.toLowerCase();

  try {
    // 1. Busca se já existe na TAB_Colaborador
    const { data: existing } = await supabase
      .from('TAB_Colaborador')
      .select('*')
      .or(`Eml_Corporativo.ilike.${email},Eml_Secundario.ilike.${email}`)
      .maybeSingle();

    if (existing) {
      // Se a foto não existia ou é placeholder genérico, atualiza para a foto oficial do Google
      if (googleUser.picture && (!existing.Des_Avatar_Url || existing.Des_Avatar_Url.includes('unsplash'))) {
        await supabase
          .from('TAB_Colaborador')
          .update({ Des_Avatar_Url: googleUser.picture })
          .eq('Idf_Colaborador', existing.Idf_Colaborador);
        existing.Des_Avatar_Url = googleUser.picture;
      }
      return mapBneToEmployee(existing);
    }

    // 2. Se for novo usuário via Google Workspace, cadastra herdando a foto do Google
    const isManager = googleUser.roleHint === 'manager' || email.includes('gestor') || email.includes('gerente') || email.includes('admin');
    const matricula = `${isManager ? 'GST' : 'PNT'}-${Math.floor(1000 + Math.random() * 9000)}`;

    const payload = {
      Cod_Matricula: matricula,
      Nme_Colaborador: googleUser.name,
      Eml_Corporativo: email,
      Des_Senha_Hash: 'google_oauth_authenticated',
      Tpo_Perfil: isManager ? 'gestor' : 'colaborador',
      Tpo_Cargo: isManager ? 'Gestor de Equipe' : 'Colaborador',
      Des_Departamento: isManager ? 'Gestão de Pessoas & Operações' : 'Operações',
      Des_Avatar_Url: googleUser.picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      Num_Telefone: '(11) 98765-4321',
      Num_Horas_Semanais: isManager ? 44 : 40,
      Flg_Ativo: true
    };

    const { data: created, error } = await supabase
      .from('TAB_Colaborador')
      .insert(payload)
      .select()
      .single();

    if (error || !created) {
      return {
        id: `google-${Date.now()}`,
        name: googleUser.name,
        role: isManager ? 'Gestor de Equipe' : 'Colaborador',
        department: isManager ? 'Gestão de Pessoas & Operações' : 'Operações',
        avatar: googleUser.picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        email: email,
        phone: '(11) 98765-4321',
        standardHoursPerWeek: isManager ? 44 : 40,
        registrationId: matricula
      };
    }

    return mapBneToEmployee(created);
  } catch (err: any) {
    console.warn('Erro ao sincronizar com Google no Supabase:', err.message);
    const isManager = googleUser.roleHint === 'manager';
    return {
      id: `google-${Date.now()}`,
      name: googleUser.name,
      role: isManager ? 'Gestor de Equipe' : 'Colaborador',
      department: isManager ? 'Gestão de Pessoas & Operações' : 'Operações',
      avatar: googleUser.picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      email: email,
      phone: '(11) 98765-4321',
      standardHoursPerWeek: isManager ? 44 : 40,
      registrationId: `${isManager ? 'GST' : 'PNT'}-9000`
    };
  }
}
