import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../../shared/supabase.js';

export const authRoutes = Router();

// Login de colaborador ou gestor
authRoutes.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, senha, perfil } = req.body;

    if (!email || !senha) {
      res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
      return;
    }

    // Busca usuário na tabela TAB_Colaborador
    const { data: usuario, error } = await supabaseAdmin
      .from('TAB_Colaborador')
      .select('*')
      .or(`Eml_Corporativo.ilike.${email},Eml_Secundario.ilike.${email}`)
      .eq('Flg_Ativo', true)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: 'Erro ao consultar o banco de dados.', details: error.message });
      return;
    }

    if (!usuario) {
      res.status(401).json({ error: 'Usuário não cadastrado ou inativo.' });
      return;
    }

    // Valida perfil solicitado
    if (perfil && usuario.Tpo_Perfil !== perfil) {
      res.status(403).json({ 
        error: `Esta conta pertence ao perfil de ${usuario.Tpo_Perfil}. Selecione a aba correspondente.` 
      });
      return;
    }

    // Validação de senha
    if (usuario.Des_Senha_Hash !== senha) {
      res.status(401).json({ error: 'Senha incorreta.' });
      return;
    }

    // Busca empresa do usuário se vinculada
    let empresaData = null;
    if (usuario.Idf_Empresa) {
      const { data: emp } = await supabaseAdmin
        .from('TAB_Empresa')
        .select('*')
        .eq('Idf_Empresa', usuario.Idf_Empresa)
        .maybeSingle();
      empresaData = emp;
    }

    // Busca gestores vinculados ao colaborador (M:N)
    let gestorIds: string[] = [];
    if (usuario.Tpo_Perfil === 'colaborador') {
      const { data: vinculos } = await supabaseAdmin
        .from('TAB_Gestor_Colaborador')
        .select('Idf_Gestor')
        .eq('Idf_Colaborador', usuario.Idf_Colaborador);
      
      if (vinculos) {
        gestorIds = vinculos.map((v: any) => v.Idf_Gestor);
      }
    }

    // Retorna os dados do usuário autenticado
    res.json({
      success: true,
      colaborador: {
        id: usuario.Idf_Colaborador,
        matricula: usuario.Cod_Matricula,
        nome: usuario.Nme_Colaborador,
        email: usuario.Eml_Corporativo,
        perfil: usuario.Tpo_Perfil,
        cargo: usuario.Tpo_Cargo,
        departamento: usuario.Des_Departamento,
        avatar: usuario.Des_Avatar_Url,
        horasSemanais: usuario.Num_Horas_Semanais,
        companyId: usuario.Idf_Empresa,
        companyCnpj: empresaData?.Num_CNPJ,
        isMasterManager: usuario.Flg_Gestor_Master || false,
        managerIds: gestorIds
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro interno no servidor.', details: err.message });
  }
});

// Listar colaboradores (filtrados por empresa e/ou gestor)
authRoutes.get('/colaboradores', async (req: Request, res: Response): Promise<void> => {
  try {
    const { empresaId, gestorId } = req.query;

    let query = supabaseAdmin
      .from('TAB_Colaborador')
      .select('Idf_Colaborador, Cod_Matricula, Nme_Colaborador, Eml_Corporativo, Tpo_Perfil, Tpo_Cargo, Des_Departamento, Des_Avatar_Url, Num_Telefone, Num_Horas_Semanais, Idf_Empresa, Flg_Gestor_Master')
      .eq('Flg_Ativo', true);

    if (empresaId) {
      query = query.eq('Idf_Empresa', empresaId);
    }

    const { data: colaboradores, error } = await query.order('Nme_Colaborador');

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Se um gestor específico foi solicitado, filtra pela tabela M:N
    if (gestorId && colaboradores) {
      const { data: vinculos } = await supabaseAdmin
        .from('TAB_Gestor_Colaborador')
        .select('Idf_Colaborador')
        .eq('Idf_Gestor', gestorId);

      const idsPermitidos = new Set(vinculos?.map((v: any) => v.Idf_Colaborador) || []);
      const filtrados = colaboradores.filter(c => idsPermitidos.has(c.Idf_Colaborador) || c.Flg_Gestor_Master);
      res.json(filtrados);
      return;
    }

    res.json(colaboradores);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Cadastro de novo gestor com gestão de Empresa e CNPJ
authRoutes.post('/registro-gestor', async (req: Request, res: Response): Promise<void> => {
  try {
    const { nome, email, senha, cnpj, cargo, departamento, telefone } = req.body;

    if (!nome || !email || !senha) {
      res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCnpj = cnpj ? cnpj.replace(/\D/g, '') : null;

    // 1. Verifica se já existe colaborador com o mesmo e-mail
    const { data: existente } = await supabaseAdmin
      .from('TAB_Colaborador')
      .select('Idf_Colaborador')
      .eq('Eml_Corporativo', cleanEmail)
      .maybeSingle();

    if (existente) {
      res.status(409).json({ error: 'Este e-mail corporativo já está cadastrado.' });
      return;
    }

    let idfEmpresa: string | null = null;
    let isMasterManager = false;

    // 2. Processa o CNPJ para Multi-Empresa
    if (cleanCnpj && cleanCnpj.length === 14) {
      const cnpjFormatado = cleanCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

      // Busca empresa existente pelo CNPJ
      const { data: empresaExistente } = await supabaseAdmin
        .from('TAB_Empresa')
        .select('Idf_Empresa')
        .eq('Num_CNPJ', cnpjFormatado)
        .maybeSingle();

      if (empresaExistente) {
        idfEmpresa = empresaExistente.Idf_Empresa;
        isMasterManager = false; // Já existe gestor máster para essa empresa
      } else {
        // Cria nova empresa e define o 1º gestor como Master
        const { data: novaEmpresa, error: empError } = await supabaseAdmin
          .from('TAB_Empresa')
          .insert({
            Num_CNPJ: cnpjFormatado,
            Nme_Razao_Social: `Empresa ${cnpjFormatado}`,
            Nme_Fantasia: `Organização ${cnpjFormatado}`,
            Flg_Ativa: true
          })
          .select()
          .single();

        if (!empError && novaEmpresa) {
          idfEmpresa = novaEmpresa.Idf_Empresa;
          isMasterManager = true; // 1º Gestor é o Master/Admin!
        }
      }
    }

    const matricula = `GST-${Math.floor(1000 + Math.random() * 9000)}`;

    // 3. Cadastra o Gestor no banco
    const { data: novoGestor, error: insertError } = await supabaseAdmin
      .from('TAB_Colaborador')
      .insert({
        Cod_Matricula: matricula,
        Nme_Colaborador: nome.trim(),
        Eml_Corporativo: cleanEmail,
        Des_Senha_Hash: senha,
        Tpo_Perfil: 'gestor',
        Tpo_Cargo: cargo?.trim() || 'Gestor Geral',
        Des_Departamento: departamento?.trim() || 'Gestão de Pessoas & Operações',
        Des_Avatar_Url: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80',
        Num_Telefone: telefone || '(11) 98765-4321',
        Num_Horas_Semanais: 44,
        Idf_Empresa: idfEmpresa,
        Flg_Gestor_Master: isMasterManager,
        Flg_Ativo: true
      })
      .select()
      .single();

    if (insertError) {
      res.status(500).json({ error: 'Erro ao cadastrar gestor no banco de dados.', details: insertError.message });
      return;
    }

    res.status(201).json({
      success: true,
      message: 'Gestor cadastrado com sucesso!',
      gestor: {
        id: novoGestor.Idf_Colaborador,
        matricula: novoGestor.Cod_Matricula,
        nome: novoGestor.Nme_Colaborador,
        email: novoGestor.Eml_Corporativo,
        perfil: novoGestor.Tpo_Perfil,
        cargo: novoGestor.Tpo_Cargo,
        departamento: novoGestor.Des_Departamento,
        companyId: idfEmpresa,
        isMasterManager: isMasterManager
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro interno ao processar cadastro de gestor.', details: err.message });
  }
});

// Vincular Colaborador a um Gestor (Relacionamento M:N)
authRoutes.post('/vincular-colaborador', async (req: Request, res: Response): Promise<void> => {
  try {
    const { gestorId, colaboradorId, empresaId, ePrincipal } = req.body;

    if (!gestorId || !colaboradorId) {
      res.status(400).json({ error: 'ID do Gestor e ID do Colaborador são obrigatórios.' });
      return;
    }

    const { data: vinculo, error } = await supabaseAdmin
      .from('TAB_Gestor_Colaborador')
      .upsert({
        Idf_Gestor: gestorId,
        Idf_Colaborador: colaboradorId,
        Idf_Empresa: empresaId || null,
        Flg_Gestor_Principal: ePrincipal ?? true
      }, { onConflict: 'Idf_Gestor,Idf_Colaborador' })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: 'Erro ao vincular gestor e colaborador.', details: error.message });
      return;
    }

    res.json({ success: true, message: 'Vínculo estabelecido com sucesso.', vinculo });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro interno ao vincular gestor e colaborador.', details: err.message });
  }
});
