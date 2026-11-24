import { supabase } from '@/shared/services/supabase';
import { Employee, ContractType } from '@/types';
import { safeStorage } from '@/shared/utils/safeStorage';
import { quotePostgrestValue } from '@/shared/utils/security';
import bcrypt from 'bcryptjs';

export const SAFE_COLABORADOR_COLUMNS =
  'Idf_Colaborador, Idf_Empresa, Cod_Matricula, Nme_Colaborador, Eml_Corporativo, Eml_Secundario, Tpo_Perfil, Tpo_Cargo, Des_Departamento, Des_Avatar_Url, Num_Telefone, Num_Horas_Semanais, Flg_Gestor_Master, Flg_Ativo, Tpo_Contrato, Dta_Inicio_Contrato, Dta_Fim_Contrato, Num_Cota_Horas_Mensal, Vlr_Hora_Pj';
export const SAFE_COLABORADOR_BASE_COLUMNS =
  'Idf_Colaborador, Idf_Empresa, Cod_Matricula, Nme_Colaborador, Eml_Corporativo, Eml_Secundario, Tpo_Perfil, Tpo_Cargo, Des_Departamento, Des_Avatar_Url, Num_Telefone, Num_Horas_Semanais, Flg_Gestor_Master, Flg_Ativo';

const PJ_CONTRACT_PARAMS_KEY = 'pontual_pj_contract_params_v1';

interface PjContractParams {
  hourlyRate?: number;
  monthlyHoursQuota?: number;
}

function getPjContractParamsMap(): Record<string, PjContractParams> {
  try {
    const raw = safeStorage.getItem(PJ_CONTRACT_PARAMS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export function savePjContractParamsLocal(emp: {
  id?: string;
  registrationId?: string;
  email?: string;
  hourlyRate?: number;
  monthlyHoursQuota?: number;
}) {
  try {
    const map = getPjContractParamsMap();
    const entry: PjContractParams = {
      hourlyRate: emp.hourlyRate !== undefined ? Number(emp.hourlyRate) : undefined,
      monthlyHoursQuota: emp.monthlyHoursQuota !== undefined ? Number(emp.monthlyHoursQuota) : undefined,
    };
    if (emp.id) map[emp.id] = { ...map[emp.id], ...entry };
    if (emp.registrationId) map[emp.registrationId.toUpperCase()] = { ...map[emp.registrationId.toUpperCase()], ...entry };
    if (emp.email) map[emp.email.toLowerCase().trim()] = { ...map[emp.email.toLowerCase().trim()], ...entry };
    safeStorage.setItem(PJ_CONTRACT_PARAMS_KEY, JSON.stringify(map));
  } catch {}
}

/**
 * Salva parâmetros contratuais de contingência em TAB_Relatorio_Pj
 * para garantir sincronização entre diferentes computadores mesmo se
 * a coluna Vlr_Hora_Pj não tiver sido criada ainda em TAB_Colaborador.
 */
export async function savePjContractParamsSupabaseBackup(
  employeeId: string,
  hourlyRate?: number,
  monthlyHoursQuota?: number
): Promise<void> {
  if (!isUuid(employeeId)) return;
  try {
    const key = '__PJ_CONTRACT_PARAMS__';
    const payload = {
      Num_Horas_Trabalhadas: 0,
      Des_Atividades: 'Parâmetros Contratuais PJ',
      Des_Links_Json: [{ title: '__PJ_CONTRACT_PARAMS__', url: JSON.stringify({ hourlyRate, monthlyHoursQuota }) }],
      Tpo_Status: 'draft'
    };
    const { data: existing } = await supabase
      .from('TAB_Relatorio_Pj')
      .select('Idf_Relatorio_Pj')
      .eq('Idf_Colaborador', employeeId)
      .eq('Des_Periodo_Referencia', key)
      .maybeSingle();

    if (existing?.Idf_Relatorio_Pj) {
      await supabase
        .from('TAB_Relatorio_Pj')
        .update(payload)
        .eq('Idf_Relatorio_Pj', existing.Idf_Relatorio_Pj);
    } else {
      await supabase
        .from('TAB_Relatorio_Pj')
        .insert({ ...payload, Idf_Colaborador: employeeId, Des_Periodo_Referencia: key });
    }
  } catch (err) {
    console.warn('Aviso ao sincronizar parâmetros PJ de contingência no Supabase:', err);
  }
}

/**
 * Carrega parâmetros de contingência do Supabase para o cache local
 */
export async function loadPjContractParamsFromSupabase(
  employeeIds: string[]
): Promise<Record<string, PjContractParams>> {
  const validIds = employeeIds.filter(id => isUuid(id));
  if (validIds.length === 0) return {};
  try {
    const { data, error } = await supabase
      .from('TAB_Relatorio_Pj')
      .select('Idf_Colaborador, Des_Links_Json')
      .in('Idf_Colaborador', validIds)
      .eq('Des_Periodo_Referencia', '__PJ_CONTRACT_PARAMS__');

    if (!error && data) {
      const result: Record<string, PjContractParams> = {};
      for (const row of data) {
        const links = Array.isArray(row.Des_Links_Json) ? row.Des_Links_Json : [];
        const meta = links.find((l: any) => l?.title === '__PJ_CONTRACT_PARAMS__');
        if (meta?.url) {
          try {
            const parsed = JSON.parse(meta.url);
            result[row.Idf_Colaborador] = parsed;
            savePjContractParamsLocal({
              id: row.Idf_Colaborador,
              hourlyRate: parsed.hourlyRate,
              monthlyHoursQuota: parsed.monthlyHoursQuota
            });
          } catch {}
        }
      }
      return result;
    }
  } catch {}
  return {};
}


function resolvePjContractParams(row: any): PjContractParams {
  const map = getPjContractParamsMap();
  const idKey = row.Idf_Colaborador || row.id || '';
  const regKey = String(row.Cod_Matricula || row.registrationId || '').toUpperCase();
  const emailKey = String(row.Eml_Corporativo || row.email || '').toLowerCase().trim();
  const local = map[idKey] || map[regKey] || map[emailKey] || {};

  const dbHourly =
    row.Vlr_Hora_Pj !== undefined && row.Vlr_Hora_Pj !== null && Number(row.Vlr_Hora_Pj) > 0
      ? Number(row.Vlr_Hora_Pj)
      : row.hourlyRate !== undefined && row.hourlyRate !== null && Number(row.hourlyRate) > 0
      ? Number(row.hourlyRate)
      : undefined;

  const dbQuota =
    row.Num_Cota_Horas_Mensal !== undefined && row.Num_Cota_Horas_Mensal !== null && Number(row.Num_Cota_Horas_Mensal) > 0
      ? Number(row.Num_Cota_Horas_Mensal)
      : row.monthlyHoursQuota !== undefined && row.monthlyHoursQuota !== null && Number(row.monthlyHoursQuota) > 0
      ? Number(row.monthlyHoursQuota)
      : undefined;

  return {
    hourlyRate: dbHourly ?? local.hourlyRate,
    monthlyHoursQuota: dbQuota ?? local.monthlyHoursQuota,
  };
}

// Converte registro do banco BNE (TAB_Colaborador) para interface Employee do Frontend
export function mapBneToEmployee(row: any): Employee {
  const isRh = row.Tpo_Perfil === 'rh' || row.Flg_Gestor_Master === true;
  const safeName = row.Nme_Colaborador || 'Colaborador';
  const pjParams = resolvePjContractParams(row);
  return {
    id: row.Idf_Colaborador || '',
    name: safeName,
    role: row.Tpo_Cargo || 'Colaborador',
    department: row.Des_Departamento || 'Geral',
    avatar: row.Des_Avatar_Url || (safeName ? `https://ui-avatars.com/api/?name=${encodeURIComponent(safeName)}&background=96183c&color=fff&size=150` : ''),
    email: row.Eml_Corporativo || '',
    phone: row.Num_Telefone || '',
    standardHoursPerWeek: Number(row.Num_Horas_Semanais) || 40,
    registrationId: row.Cod_Matricula || '',
    companyId: row.Idf_Empresa || '',
    isMasterManager: row.Flg_Gestor_Master || false,
    isRh: isRh,
    roleType: row.Tpo_Perfil === 'rh' ? 'rh' : row.Tpo_Perfil === 'gestor' ? 'gestor' : 'colaborador',
    managerIds: Array.isArray(row.managerIds) ? row.managerIds : [],
    contractType: (row.Tpo_Contrato as ContractType) || (row.contractType as ContractType) || 'CLT',
    contractStartDate: row.Dta_Inicio_Contrato ? row.Dta_Inicio_Contrato.split('T')[0] : (row.contractStartDate || undefined),
    contractEndDate: row.Dta_Fim_Contrato ? row.Dta_Fim_Contrato.split('T')[0] : (row.contractEndDate || undefined),
    monthlyHoursQuota: pjParams.monthlyHoursQuota,
    hourlyRate: pjParams.hourlyRate
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

// Busca um colaborador pelo ID (usado para reidratar a sessão após F5 — nunca seleciona Des_Senha_Hash)
export async function getColaboradorByIdSupabase(colaboradorId: string): Promise<Employee | null> {
  if (!isUuid(colaboradorId)) return null;
  try {
    let { data, error } = await supabase
      .from('TAB_Colaborador')
      .select(SAFE_COLABORADOR_COLUMNS)
      .eq('Idf_Colaborador', colaboradorId)
      .eq('Flg_Ativo', true)
      .maybeSingle();

    if (error && (error.code === '42703' || error.message?.includes('does not exist'))) {
      const retry = await supabase
        .from('TAB_Colaborador')
        .select(SAFE_COLABORADOR_BASE_COLUMNS)
        .eq('Idf_Colaborador', colaboradorId)
        .eq('Flg_Ativo', true)
        .maybeSingle();
      data = retry.data as any;
      error = retry.error;
    }
    if (error || !data) return null;
    const links = await getManagerLinksMap([colaboradorId]);
    await loadPjContractParamsFromSupabase([colaboradorId]);
    const emp = mapBneToEmployee(data);
    emp.managerIds = links.get(colaboradorId) || [];
    if (!emp.companyId && emp.managerIds.length > 0) {
      const managerEmpresa = await getEmpresaDoColaborador(emp.managerIds[0]);
      if (managerEmpresa) {
        emp.companyId = managerEmpresa;
        await supabase
          .from('TAB_Colaborador')
          .update({ Idf_Empresa: managerEmpresa })
          .eq('Idf_Colaborador', colaboradorId);
      }
    }
    return emp;
  } catch {
    return null;
  }
}

// Busca colaboradores do Supabase com suporte a filtragem por empresa e gestor
export async function getColaboradoresSupabase(filter?: { companyId?: string; gestorId?: string }): Promise<Employee[]> {
  try {
    // Nunca retorna registros globais se não houver companyId nem gestorId
    if (!filter?.companyId && !filter?.gestorId) {
      return [];
    }

    const buildColabQuery = (cols: string) => {
      let q = supabase
        .from('TAB_Colaborador')
        .select(cols)
        .eq('Flg_Ativo', true);
      if (filter?.companyId && isUuid(filter.companyId)) {
        q = q.eq('Idf_Empresa', filter.companyId);
      } else if (linkedFilterIds) {
        q = q.in('Idf_Colaborador', linkedFilterIds);
      }
      return q.order('Nme_Colaborador');
    };

    let linkedFilterIds: string[] | null = null;
    if (!(filter?.companyId && isUuid(filter.companyId))) {
      if (filter?.gestorId && isUuid(filter.gestorId)) {
        const { data: gestorLinks } = await supabase
          .from('TAB_Gestor_Colaborador')
          .select('Idf_Colaborador')
          .eq('Idf_Gestor', filter.gestorId);
        linkedFilterIds = Array.from(new Set([filter.gestorId, ...(gestorLinks || []).map((l: any) => l.Idf_Colaborador)])).filter(isUuid);
      } else {
        return [];
      }
    }

    let { data, error } = await buildColabQuery(SAFE_COLABORADOR_COLUMNS);
    if (error && (error.code === '42703' || error.message?.includes('does not exist'))) {
      const retry = await buildColabQuery(SAFE_COLABORADOR_BASE_COLUMNS);
      data = retry.data as any;
      error = retry.error;
    }

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
        let { data: orphans, error: orphanErr } = await supabase
          .from('TAB_Colaborador')
          .select(SAFE_COLABORADOR_COLUMNS)
          .in('Idf_Colaborador', candidateIds)
          .is('Idf_Empresa', null)
          .eq('Flg_Ativo', true);

        if (orphanErr && (orphanErr.code === '42703' || orphanErr.message?.includes('does not exist'))) {
          const orphanRetry = await supabase
            .from('TAB_Colaborador')
            .select(SAFE_COLABORADOR_BASE_COLUMNS)
            .in('Idf_Colaborador', candidateIds)
            .is('Idf_Empresa', null)
            .eq('Flg_Ativo', true);
          orphans = orphanRetry.data as any;
        }

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

    const pjIds = rows.filter(r => r.Tpo_Contrato === 'PJ' || r.contractType === 'PJ').map(r => r.Idf_Colaborador);
    if (pjIds.length > 0) {
      await loadPjContractParamsFromSupabase(pjIds);
    }

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

/**
 * Verifica se um e-mail já está cadastrado no sistema (Supabase, equipe local ou storage).
 * Retorna true se o e-mail já estiver em uso.
 */
export async function checkEmailExists(email?: string, excludeId?: string): Promise<boolean> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) return false;

  // 1. Verifica no localStorage (pontual_registered_users)
  try {
    const localUsers = JSON.parse(safeStorage.getItem('pontual_registered_users') || '[]');
    const foundLocal = localUsers.some((u: any) => {
      if (excludeId && (u.Idf_Colaborador === excludeId || u.id === excludeId)) return false;
      const eml = (u.Eml_Corporativo || u.email || '').toLowerCase().trim();
      const sec = (u.Eml_Secundario || '').toLowerCase().trim();
      return eml === cleanEmail || sec === cleanEmail;
    });
    if (foundLocal) return true;
  } catch {}

  // 2. Consulta no Supabase (TAB_Colaborador)
  try {
    const quotedEmail = quotePostgrestValue(cleanEmail);
    let query = supabase
      .from('TAB_Colaborador')
      .select('Idf_Colaborador, Eml_Corporativo, Eml_Secundario')
      .or(`Eml_Corporativo.ilike.${quotedEmail},Eml_Secundario.ilike.${quotedEmail}`)
      .limit(1);

    if (excludeId && isUuid(excludeId)) {
      query = query.neq('Idf_Colaborador', excludeId);
    }

    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      return true;
    }
  } catch (err) {
    console.warn('[checkEmailExists] Erro ao consultar Supabase:', err);
  }

  return false;
}

// Salva um novo colaborador diretamente na tabela TAB_Colaborador e estabelece o vínculo M:N em TAB_Gestor_Colaborador
export async function createColaboradorSupabase(emp: Employee, creatorGestorId?: string): Promise<Employee> {
  const cleanEmail = emp.email?.trim().toLowerCase();
  if (cleanEmail) {
    const emailInUse = await checkEmailExists(cleanEmail, emp.id);
    if (emailInUse) {
      throw new Error(`O e-mail "${emp.email}" já está cadastrado no sistema. Não é possível cadastrar novamente.`);
    }
  }

  const matricula = emp.registrationId || `PNT-${Math.floor(1000 + Math.random() * 9000)}`;

  // Salva parâmetros PJ localmente antes de enviar ao banco para garantir disponibilidade imediata
  savePjContractParamsLocal({
    id: emp.id,
    registrationId: matricula,
    email: emp.email,
    hourlyRate: emp.hourlyRate,
    monthlyHoursQuota: emp.monthlyHoursQuota,
  });

  // A empresa do novo cadastro é sempre a do gestor/RH que está cadastrando.
  // Se o objeto não trouxer uma empresa válida, busca no banco a empresa do criador.
  let companyId: string | null = isUuid(emp.companyId) ? emp.companyId! : null;
  if (!companyId) {
    companyId = await getEmpresaDoColaborador(creatorGestorId);
  }

  const perfil = emp.roleType === 'rh' ? 'rh' : emp.roleType === 'gestor' ? 'gestor' : (emp.isRh ? 'rh' : 'colaborador');
  const provisionalHash = bcrypt.hashSync(matricula, 10);
  const basePayload: any = {
    Cod_Matricula: matricula,
    Nme_Colaborador: emp.name,
    Eml_Corporativo: emp.email,
    Des_Senha_Hash: provisionalHash, // Hash da matrícula como senha provisória segura
    Tpo_Perfil: perfil,
    Tpo_Cargo: emp.role,
    Des_Departamento: emp.department,
    Des_Avatar_Url: emp.avatar,
    Num_Telefone: emp.phone,
    Num_Horas_Semanais: emp.standardHoursPerWeek || 40,
    Tpo_Contrato: emp.contractType || 'CLT',
    Dta_Inicio_Contrato: emp.contractStartDate || null,
    Dta_Fim_Contrato: emp.contractEndDate || null,
    Num_Cota_Horas_Mensal: emp.monthlyHoursQuota || (emp.contractType === 'PJ' ? 160 : null),
    Vlr_Hora_Pj: emp.hourlyRate !== undefined ? Number(emp.hourlyRate) : (emp.contractType === 'PJ' ? 0 : null),
    Idf_Empresa: companyId,
    Flg_Gestor_Master: perfil === 'rh',
    Flg_Ativo: true
  };

  let { data: novoColaborador, error }: { data: any; error: any } = await supabase
    .from('TAB_Colaborador')
    .insert(basePayload)
    .select(SAFE_COLABORADOR_COLUMNS)
    .single();

  // Caso a coluna Vlr_Hora_Pj ainda não tenha sido migrada no banco do cliente, tenta novamente sem ela
  if (error && (error.message?.includes('Vlr_Hora_Pj') || error.code === '42703' || error.message?.includes('does not exist'))) {
    const fallbackPayload = { ...basePayload };
    delete fallbackPayload.Vlr_Hora_Pj;
    const retry = await supabase
      .from('TAB_Colaborador')
      .insert(fallbackPayload)
      .select(SAFE_COLABORADOR_BASE_COLUMNS)
      .single();
    novoColaborador = retry.data;
    error = retry.error;
  }

  if (error) {
    if (error.code === '23505' || error.message?.includes('Eml_Corporativo') || error.message?.includes('unique') || error.message?.includes('duplicate key')) {
      throw new Error(`DUPLICATE_EMAIL: O e-mail "${emp.email}" já está cadastrado no sistema. Não é possível cadastrar novamente.`);
    }
    console.error('Erro ao inserir colaborador no Supabase:', error.message);
    throw new Error(error.message);
  }

  // Atualiza também com o UUID gerado pelo banco
  savePjContractParamsLocal({
    id: novoColaborador.Idf_Colaborador,
    registrationId: matricula,
    email: emp.email,
    hourlyRate: emp.hourlyRate,
    monthlyHoursQuota: emp.monthlyHoursQuota,
  });

  if (emp.contractType === 'PJ') {
    savePjContractParamsSupabaseBackup(novoColaborador.Idf_Colaborador, emp.hourlyRate, emp.monthlyHoursQuota);
  }

  // Estabelece os vínculos de gestores (M:N) na tabela TAB_Gestor_Colaborador
  const gestoresParaVincular: string[] = [];
  if (creatorGestorId) gestoresParaVincular.push(creatorGestorId);
  (emp.managerIds || []).forEach(id => { if (!gestoresParaVincular.includes(id)) gestoresParaVincular.push(id); });
  const gestoresValidos = gestoresParaVincular.filter(id => isUuid(id) && id !== novoColaborador.Idf_Colaborador);

  await saveGestorLinks(novoColaborador.Idf_Colaborador, gestoresValidos, companyId);

  const mapped = mapBneToEmployee(novoColaborador);
  mapped.managerIds = gestoresValidos;
  if (emp.hourlyRate !== undefined) mapped.hourlyRate = Number(emp.hourlyRate);
  if (emp.monthlyHoursQuota !== undefined) mapped.monthlyHoursQuota = Number(emp.monthlyHoursQuota);
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

  const emailInUse = await checkEmailExists(cleanEmail);
  if (emailInUse) {
    throw new Error(`DUPLICATE_EMAIL: O e-mail corporativo "${cleanEmail}" já está cadastrado no sistema. Não é possível cadastrar novamente.`);
  }

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
        throw new Error('DUPLICATE_CNPJ: Este CNPJ já possui uma organização cadastrada no sistema. Solicite o acesso diretamente ao gestor administrador da empresa.');
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
  const gestorHash = bcrypt.hashSync(gestorData.password, 10);
  const payload = {
    Cod_Matricula: matricula,
    Nme_Colaborador: gestorData.name.trim(),
    Eml_Corporativo: cleanEmail,
    Des_Senha_Hash: gestorHash,
    Tpo_Perfil: isRhFinal ? 'rh' : 'gestor',
    Tpo_Cargo: gestorData.role?.trim() || (isRhFinal ? 'Gerente de RH & Administração Geral' : 'Gestor de Setor'),
    Des_Departamento: gestorData.department?.trim() || (isRhFinal ? 'Recursos Humanos & Gestão Geral' : 'Gestão de Pessoas & Operações'),
    Des_Avatar_Url: `https://ui-avatars.com/api/?name=${encodeURIComponent(gestorData.name.trim())}&background=96183c&color=fff&size=150`,
    Num_Telefone: gestorData.phone?.trim() || '(11) 98765-4321',
    Num_Horas_Semanais: 44,
    Idf_Empresa: companyId,
    Flg_Gestor_Master: isRhFinal,
    Flg_Ativo: true
  };

  const { data, error } = await supabase
    .from('TAB_Colaborador')
    .insert(payload)
    .select(SAFE_COLABORADOR_BASE_COLUMNS)
    .single();

  if (error) {
    if (error.code === '23505' || error.message?.includes('Eml_Corporativo') || error.message?.includes('unique') || error.message?.includes('duplicate key')) {
      throw new Error(`DUPLICATE_EMAIL: O e-mail corporativo "${cleanEmail}" já está cadastrado no sistema. Não é possível cadastrar novamente.`);
    }
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
    // 1. Verifica se a conta já existe na tabela TAB_Colaborador e está ativa (sem dump global SELECT *)
    let existing: any = null;
    const quotedEmail = quotePostgrestValue(email);
    try {
      let { data, error } = await supabase
        .from('TAB_Colaborador')
        .select(SAFE_COLABORADOR_COLUMNS)
        .or(`Eml_Corporativo.ilike.${quotedEmail},Eml_Secundario.ilike.${quotedEmail}`)
        .eq('Flg_Ativo', true)
        .limit(1)
        .maybeSingle();

      if (error && (error.code === '42703' || error.message?.includes('does not exist'))) {
        const retry = await supabase
          .from('TAB_Colaborador')
          .select(SAFE_COLABORADOR_BASE_COLUMNS)
          .or(`Eml_Corporativo.ilike.${quotedEmail},Eml_Secundario.ilike.${quotedEmail}`)
          .eq('Flg_Ativo', true)
          .limit(1)
          .maybeSingle();
        data = retry.data as any;
        error = retry.error;
      }

      if (!error && data) {
        existing = data;
      }
    } catch (queryErr) {
      console.warn('Aviso ao consultar usuário Google via filtro direto:', queryErr);
    }

    // Se encontrou no Supabase:
    if (existing) {
      // Atualiza foto de perfil do Google caso não tenha uma foto personalizada
      if (googleUser.picture && (!existing.Des_Avatar_Url || existing.Des_Avatar_Url.includes('unsplash') || existing.Des_Avatar_Url.includes('ui-avatars'))) {
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

    // 2. Se não encontrou no banco, verifica se foi cadastrado localmente no storage
    try {
      const registeredStr = safeStorage.getItem('pontual_registered_users');
      if (registeredStr) {
        const list = JSON.parse(registeredStr);
        const localMatch = list.find((u: any) => 
          (u.email && u.email.toLowerCase().trim() === email) ||
          (u.Eml_Corporativo && u.Eml_Corporativo.toLowerCase().trim() === email)
        );
        if (localMatch) {
          return mapBneToEmployee(localMatch);
        }
      }
    } catch {}

    // Se NÃO estiver previamente cadastrada, rejeita o acesso (não cria novo colaborador não autorizado)
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
    savePjContractParamsLocal({
      id: emp.id,
      registrationId: emp.registrationId,
      email: emp.email,
      hourlyRate: emp.hourlyRate,
      monthlyHoursQuota: emp.monthlyHoursQuota,
    });

    if (emp.contractType === 'PJ') {
      savePjContractParamsSupabaseBackup(emp.id, emp.hourlyRate, emp.monthlyHoursQuota);
    }

    if (!isUuid(emp.id)) return true;

    const payload: any = {};
    if (emp.name) payload.Nme_Colaborador = emp.name;
    if (emp.role) payload.Tpo_Cargo = emp.role;
    if (emp.department) payload.Des_Departamento = emp.department;
    if (emp.phone) payload.Num_Telefone = emp.phone;
    if (emp.standardHoursPerWeek) payload.Num_Horas_Semanais = emp.standardHoursPerWeek;
    if (emp.contractType !== undefined) payload.Tpo_Contrato = emp.contractType;
    if (emp.contractStartDate !== undefined) payload.Dta_Inicio_Contrato = emp.contractStartDate || null;
    if (emp.contractEndDate !== undefined) payload.Dta_Fim_Contrato = emp.contractEndDate || null;
    if (emp.monthlyHoursQuota !== undefined) payload.Num_Cota_Horas_Mensal = emp.monthlyHoursQuota || null;
    if (emp.hourlyRate !== undefined) payload.Vlr_Hora_Pj = emp.hourlyRate !== null ? Number(emp.hourlyRate) : null;
    if (emp.roleType) {
      payload.Tpo_Perfil = emp.roleType;
      payload.Flg_Gestor_Master = emp.roleType === 'rh';
    }

    let { error } = await supabase
      .from('TAB_Colaborador')
      .update(payload)
      .eq('Idf_Colaborador', emp.id);

    if (error && error.message && error.message.includes('Vlr_Hora_Pj')) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.Vlr_Hora_Pj;
      const retry = await supabase
        .from('TAB_Colaborador')
        .update(fallbackPayload)
        .eq('Idf_Colaborador', emp.id);
      error = retry.error;
    }

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

const PASSWORD_CHANGED_USERS_KEY = 'pontual_password_changed_users_v1';

export function markUserPasswordChangedLocal(info: {
  id?: string;
  matricula?: string;
  email?: string;
}) {
  try {
    const raw = safeStorage.getItem(PASSWORD_CHANGED_USERS_KEY) || (typeof window !== 'undefined' ? window.localStorage.getItem(PASSWORD_CHANGED_USERS_KEY) : null);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const set = new Set(list.map(s => String(s).toLowerCase().trim()));
    if (info.id) set.add(String(info.id).toLowerCase().trim());
    if (info.matricula) {
      const mat = String(info.matricula).toLowerCase().trim();
      set.add(mat);
      const digits = mat.replace(/^pnt-|^gst-|^col-|^mat-/i, '');
      if (digits.length >= 3) set.add(digits);
    }
    if (info.email) set.add(String(info.email).toLowerCase().trim());
    const serialized = JSON.stringify(Array.from(set));
    safeStorage.setItem(PASSWORD_CHANGED_USERS_KEY, serialized);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PASSWORD_CHANGED_USERS_KEY, serialized);
    }
  } catch {}
}

export function hasUserChangedPasswordLocal(user: any): boolean {
  if (!user) return false;
  try {
    const raw = safeStorage.getItem(PASSWORD_CHANGED_USERS_KEY) || (typeof window !== 'undefined' ? window.localStorage.getItem(PASSWORD_CHANGED_USERS_KEY) : null);
    if (raw) {
      const list: string[] = JSON.parse(raw);
      const set = new Set(list.map(s => String(s).toLowerCase().trim()));
      const id = String(user.Idf_Colaborador || user.id || '').toLowerCase().trim();
      const mat = String(user.Cod_Matricula || user.registrationId || user.matricula || '').toLowerCase().trim();
      const email = String(user.Eml_Corporativo || user.email || '').toLowerCase().trim();
      if ((id && set.has(id)) || (mat && set.has(mat)) || (email && set.has(email))) {
        return true;
      }
    }
  } catch {}
  if (user.Dta_Cadastro && user.Dta_Atualizacao) {
    const tCad = new Date(user.Dta_Cadastro).getTime();
    const tAtu = new Date(user.Dta_Atualizacao).getTime();
    if (!isNaN(tCad) && !isNaN(tAtu) && Math.abs(tAtu - tCad) > 2000) {
      return true;
    }
  }
  return false;
}

function getBackendAuthEndpoints(path: string): string[] {
  const backendBase = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
  return [
    ...(backendBase ? [`${backendBase}/api/auth${path}`] : []),
    `/api/auth${path}`,
    ...(import.meta.env.DEV ? [`http://localhost:5000/api/auth${path}`] : []),
  ];
}

// Solicita link seguro de redefinição de senha com token criptográfico enviado por e-mail
export async function requestPasswordResetToken(email: string): Promise<{ success: boolean; message: string }> {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { success: false, message: 'Informe um e-mail corporativo válido.' };
  }

  for (const endpoint of getBackendAuthEndpoints('/request-password-reset')) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const json = await response.json().catch(() => null);
      if (response.ok) {
        return {
          success: true,
          message:
            json?.message ||
            'Se o e-mail estiver cadastrado, enviaremos um link seguro de redefinição de senha válido por 30 minutos.',
        };
      }
      if (response.status >= 400 && response.status < 500) {
        return {
          success: false,
          message: json?.message || json?.error || 'Não foi possível solicitar a redefinição de senha.',
        };
      }
    } catch {
      // tenta próximo endpoint
    }
  }

  return {
    success: false,
    message: 'Serviço de redefinição de senha indisponível no momento. Tente novamente ou contate o RH.',
  };
}

// Confirma a nova senha usando o token criptográfico de uso único recebido por e-mail
export async function confirmPasswordResetWithToken(
  token: string,
  novaSenha: string
): Promise<{ success: boolean; message: string }> {
  const cleanToken = String(token || '').trim();
  const cleanPass = String(novaSenha || '').trim();

  if (!cleanToken) {
    return { success: false, message: 'Token de redefinição ausente ou inválido.' };
  }
  if (cleanPass.length < 6) {
    return { success: false, message: 'A nova senha deve ter no mínimo 6 caracteres.' };
  }

  for (const endpoint of getBackendAuthEndpoints('/reset-password')) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cleanToken, novaSenha: cleanPass }),
      });
      const json = await response.json().catch(() => null);
      if (response.ok) {
        return {
          success: true,
          message: json?.message || 'Senha redefinida com sucesso! Faça login com sua nova senha.',
        };
      }
      if (response.status >= 400 && response.status < 500) {
        return {
          success: false,
          message: json?.message || json?.error || 'Link de redefinição inválido ou expirado.',
        };
      }
    } catch {
      // tenta próximo endpoint
    }
  }

  return {
    success: false,
    message: 'Não foi possível conectar ao servidor para concluir a redefinição de senha.',
  };
}

// Desativada por segurança: impede sobrescrita direta de senha sem token validado no servidor
export async function updateColaboradorPasswordSupabase(_identifier: string, _novaSenha: string): Promise<boolean> {
  throw new Error('Redefinição direta desativada por segurança. Utilize o link com token enviado ao seu e-mail.');
}
