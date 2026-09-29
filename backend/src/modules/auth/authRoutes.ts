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

    // Validação simples de senha (em produção recomenda-se bcrypt)
    if (usuario.Des_Senha_Hash !== senha) {
      res.status(401).json({ error: 'Senha incorreta.' });
      return;
    }

    // Retorna os dados do colaborador autenticado
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
        horasSemanais: usuario.Num_Horas_Semanais
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro interno no servidor.', details: err.message });
  }
});

// Listar todos os colaboradores ativos
authRoutes.get('/colaboradores', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('TAB_Colaborador')
      .select('Idf_Colaborador, Cod_Matricula, Nme_Colaborador, Eml_Corporativo, Tpo_Perfil, Tpo_Cargo, Des_Departamento, Des_Avatar_Url, Num_Telefone, Num_Horas_Semanais')
      .eq('Flg_Ativo', true)
      .order('Nme_Colaborador');

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
