import { getTodayDateString } from '@/shared/utils/dateUtils';
import { supabase } from '@/shared/services/supabase';
import { TimeOffRequest, AbsenceJustification, Employee } from '@/types';

function isValidUuid(id?: string): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export async function ensureColaboradorUuidSupabase(activeEmp?: Employee): Promise<string | null> {
  if (!activeEmp) return null;

  if (isValidUuid(activeEmp.id)) {
    return activeEmp.id;
  }

  const cleanEmail = activeEmp.email?.trim().toLowerCase();
  if (cleanEmail) {
    try {
      const { data: empData } = await supabase
        .from('TAB_Colaborador')
        .select('Idf_Colaborador')
        .or(`Eml_Corporativo.ilike.${cleanEmail},Eml_Secundario.ilike.${cleanEmail}`)
        .maybeSingle();

      if (empData?.Idf_Colaborador && isValidUuid(empData.Idf_Colaborador)) {
        return empData.Idf_Colaborador;
      }
    } catch (err) {
      console.warn('Aviso ao consultar TAB_Colaborador por e-mail:', err);
    }
  }

  try {
    const { data: anyColab } = await supabase
      .from('TAB_Colaborador')
      .select('Idf_Colaborador')
      .eq('Flg_Ativo', true)
      .limit(1)
      .maybeSingle();

    if (anyColab?.Idf_Colaborador && isValidUuid(anyColab.Idf_Colaborador)) {
      return anyColab.Idf_Colaborador;
    }
  } catch {}

  try {
    const matricula = activeEmp.registrationId || `MAT-${Math.floor(1000 + Math.random() * 9000)}`;
    const isRh = activeEmp.isRh || activeEmp.roleType === 'rh' || activeEmp.isMasterManager;
    const perfil = isRh ? 'rh' : (activeEmp.roleType === 'gestor' || activeEmp.isMasterManager ? 'gestor' : 'colaborador');
    const finalEmail = cleanEmail || `colab-${Date.now()}@pontual.com`;

    const payload = {
      Cod_Matricula: matricula,
      Nme_Colaborador: activeEmp.name || 'Colaborador',
      Eml_Corporativo: finalEmail,
      Des_Senha_Hash: matricula,
      Tpo_Perfil: perfil,
      Tpo_Cargo: activeEmp.role || 'Colaborador',
      Des_Departamento: activeEmp.department || 'Geral',
      Des_Avatar_Url: activeEmp.avatar || null,
      Num_Telefone: activeEmp.phone || '(11) 99999-9999',
      Num_Horas_Semanais: activeEmp.standardHoursPerWeek || 40,
      Idf_Empresa: activeEmp.companyId || null,
      Flg_Gestor_Master: activeEmp.isMasterManager || false,
      Flg_Ativo: true
    };

    const { data: created, error: createErr } = await supabase
      .from('TAB_Colaborador')
      .insert(payload)
      .select('Idf_Colaborador')
      .single();

    if (!createErr && created?.Idf_Colaborador) {
      return created.Idf_Colaborador;
    }
    if (createErr) {
      console.error('Erro ao auto-criar colaborador no Supabase:', createErr.message);
    }
  } catch (err: any) {
    console.error('Exceção ao auto-criar colaborador no Supabase:', err.message);
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ATESTATOS / JUSTIFICATIVAS DE AUSÊNCIA (TAB_Justificativa_Ausencia)
// ─────────────────────────────────────────────────────────────────────────────

export async function getJustificativasSupabase(empIds?: string[]): Promise<AbsenceJustification[]> {
  try {
    let query = supabase.from('TAB_Justificativa_Ausencia').select('*');

    if (empIds && empIds.length > 0) {
      const validEmpIds = empIds.filter(id => isValidUuid(id));
      if (validEmpIds.length > 0) {
        query = query.in('Idf_Colaborador', validEmpIds);
      }
    }

    const { data, error } = await query.order('Dta_Envio', { ascending: false });

    if (error) {
      console.warn('Aviso ao buscar TAB_Justificativa_Ausencia do Supabase:', error.message);
      return [];
    }

    if (data && data.length > 0) {
      return data.map((row: any) => ({
        id: row.Idf_Justificativa,
        employeeId: row.Idf_Colaborador,
        employeeName: '',
        employeeAvatar: '',
        shiftId: row.Idf_Turno || '',
        date: row.Dta_Ausencia,
        reason: row.Des_Motivo || '',
        documentName: row.Nme_Documento || '',
        documentType: row.Tpo_Documento || 'application/pdf',
        documentUrl: row.Des_Url_Documento || '',
        status: (row.Tpo_Status === 'approved' || row.Tpo_Status === 'aprovado') ? 'approved' : (row.Tpo_Status === 'rejected' || row.Tpo_Status === 'recusado') ? 'rejected' : 'pending',
        submittedAt: row.Dta_Envio ? new Date(row.Dta_Envio).toLocaleDateString('pt-BR') : 'Hoje',
        managerNotes: row.Des_Parecer_Gestor || ''
      }));
    }
    return [];
  } catch (err: any) {
    console.error('Erro ao buscar justificativas no Supabase:', err.message);
    return [];
  }
}

export async function createJustificativaSupabase(
  just: Partial<AbsenceJustification>,
  activeEmp?: Employee
): Promise<AbsenceJustification | null> {
  try {
    let colabId = just.employeeId;
    if (!isValidUuid(colabId)) {
      colabId = (await ensureColaboradorUuidSupabase(activeEmp)) || undefined;
    }

    if (!colabId || !isValidUuid(colabId)) {
      console.warn('Não foi possível identificar UUID válido para o colaborador ao salvar justificativa.');
      return null;
    }

    const payload = {
      Idf_Colaborador: colabId,
      Idf_Turno: isValidUuid(just.shiftId) ? just.shiftId : null,
      Dta_Ausencia: just.date || getTodayDateString(),
      Des_Motivo: just.reason || 'Justificativa de Ausência / Atestado Médico',
      Cod_Cid_Atestado: (just as any).cidCode || null,
      Nme_Documento: just.documentName || 'Atestado_Medico.pdf',
      Tpo_Documento: just.documentType || 'application/pdf',
      Des_Url_Documento: just.documentUrl || null,
      Tpo_Status: 'pending',
      Dta_Envio: new Date().toISOString(),
      Dta_Atualizacao: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('TAB_Justificativa_Ausencia')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Erro ao inserir em TAB_Justificativa_Ausencia:', error.message);
      return null;
    }

    return {
      id: data.Idf_Justificativa,
      employeeId: data.Idf_Colaborador,
      employeeName: activeEmp?.name || 'Colaborador',
      employeeAvatar: activeEmp?.avatar || '',
      shiftId: data.Idf_Turno || '',
      date: data.Dta_Ausencia,
      reason: data.Des_Motivo,
      documentName: data.Nme_Documento,
      documentType: data.Tpo_Documento,
      documentUrl: data.Des_Url_Documento,
      status: 'pending',
      submittedAt: new Date().toLocaleDateString('pt-BR'),
      managerNotes: data.Des_Parecer_Gestor || ''
    };
  } catch (err: any) {
    console.error('Erro ao criar justificativa no Supabase:', err.message);
    return null;
  }
}

export async function updateJustificativaStatusSupabase(
  id: string,
  status: 'approved' | 'rejected',
  parecer?: string
): Promise<boolean> {
  try {
    if (!isValidUuid(id)) return false;

    const { error } = await supabase
      .from('TAB_Justificativa_Ausencia')
      .update({
        Tpo_Status: status,
        Des_Parecer_Gestor: parecer || (status === 'approved' ? 'Homologado pelo RH' : 'Não homologado'),
        Dta_Atualizacao: new Date().toISOString()
      })
      .eq('Idf_Justificativa', id);

    if (error) {
      console.error('Erro ao atualizar status em TAB_Justificativa_Ausencia:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('Erro ao atualizar justificativa no Supabase:', err.message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SOLICITAÇÕES DE FOLGA / TROCA (TAB_Solicitacao_Colaborador)
// ─────────────────────────────────────────────────────────────────────────────

export async function getSolicitacoesSupabase(empIds?: string[]): Promise<TimeOffRequest[]> {
  try {
    let query = supabase.from('TAB_Solicitacao_Colaborador').select('*');

    if (empIds && empIds.length > 0) {
      const validEmpIds = empIds.filter(id => isValidUuid(id));
      if (validEmpIds.length > 0) {
        query = query.in('Idf_Colaborador_Solicitante', validEmpIds);
      }
    }

    const { data, error } = await query.order('Dta_Cadastro', { ascending: false });

    if (error) {
      console.warn('Aviso ao buscar TAB_Solicitacao_Colaborador do Supabase:', error.message);
      return [];
    }

    if (data && data.length > 0) {
      return data.map((row: any) => ({
        id: row.Idf_Solicitacao,
        employeeId: row.Idf_Colaborador_Solicitante,
        employeeName: '',
        employeeAvatar: '',
        type: (row.Tpo_Solicitacao === 'troca' || row.Tpo_Solicitacao === 'swap') ? 'swap' : 'time_off',
        date: row.Dta_Solicitada,
        shiftId: row.Idf_Turno || '',
        targetEmployeeId: row.Idf_Colaborador_Destino || '',
        targetEmployeeName: '',
        reason: row.Des_Motivo || '',
        status: (row.Tpo_Status_Solicitacao === 'approved' || row.Tpo_Status_Solicitacao === 'aprovado') ? 'approved' : (row.Tpo_Status_Solicitacao === 'rejected' || row.Tpo_Status_Solicitacao === 'recusado') ? 'rejected' : 'pending',
        createdAt: row.Dta_Cadastro ? new Date(row.Dta_Cadastro).toLocaleDateString('pt-BR') : 'Hoje',
        managerNotes: row.Des_Parecer_Gestor || ''
      }));
    }
    return [];
  } catch (err: any) {
    console.error('Erro ao buscar solicitações no Supabase:', err.message);
    return [];
  }
}

export async function createSolicitacaoSupabase(
  req: Partial<TimeOffRequest>,
  activeEmp?: Employee
): Promise<TimeOffRequest | null> {
  try {
    let colabId = req.employeeId;
    if (!isValidUuid(colabId)) {
      colabId = (await ensureColaboradorUuidSupabase(activeEmp)) || undefined;
    }

    if (!colabId || !isValidUuid(colabId)) {
      console.warn('Não foi possível identificar UUID válido para o solicitante.');
      return null;
    }

    const payload = {
      Idf_Colaborador_Solicitante: colabId,
      Idf_Colaborador_Destino: isValidUuid(req.targetEmployeeId) ? req.targetEmployeeId : null,
      Idf_Turno: isValidUuid(req.shiftId) ? req.shiftId : null,
      Tpo_Solicitacao: req.type === 'swap' ? 'troca' : 'folga',
      Dta_Solicitada: req.date || getTodayDateString(),
      Des_Motivo: req.reason || 'Solicitação de Folga / Troca de Turno',
      Tpo_Status_Solicitacao: 'pending',
      Dta_Cadastro: new Date().toISOString(),
      Dta_Atualizacao: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('TAB_Solicitacao_Colaborador')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Erro ao inserir em TAB_Solicitacao_Colaborador:', error.message);
      return null;
    }

    return {
      id: data.Idf_Solicitacao,
      employeeId: data.Idf_Colaborador_Solicitante,
      employeeName: activeEmp?.name || 'Colaborador',
      employeeAvatar: activeEmp?.avatar || '',
      type: data.Tpo_Solicitacao === 'troca' ? 'swap' : 'time_off',
      date: data.Dta_Solicitada,
      shiftId: data.Idf_Turno || '',
      targetEmployeeId: data.Idf_Colaborador_Destino || '',
      targetEmployeeName: req.targetEmployeeName || '',
      reason: data.Des_Motivo,
      status: 'pending',
      createdAt: new Date().toLocaleDateString('pt-BR'),
      managerNotes: data.Des_Parecer_Gestor || ''
    };
  } catch (err: any) {
    console.error('Erro ao criar solicitação no Supabase:', err.message);
    return null;
  }
}

export async function updateSolicitacaoStatusSupabase(
  id: string,
  status: 'approved' | 'rejected',
  parecer?: string
): Promise<boolean> {
  try {
    if (!isValidUuid(id)) return false;

    const { error } = await supabase
      .from('TAB_Solicitacao_Colaborador')
      .update({
        Tpo_Status_Solicitacao: status,
        Des_Parecer_Gestor: parecer || (status === 'approved' ? 'Aprovado pelo gestor' : 'Recusado pelo gestor'),
        Dta_Atualizacao: new Date().toISOString()
      })
      .eq('Idf_Solicitacao', id);

    if (error) {
      console.error('Erro ao atualizar status em TAB_Solicitacao_Colaborador:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('Erro ao atualizar solicitação no Supabase:', err.message);
    return false;
  }
}

