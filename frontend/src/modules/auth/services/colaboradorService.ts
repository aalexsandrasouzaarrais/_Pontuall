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
