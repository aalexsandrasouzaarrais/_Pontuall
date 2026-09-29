import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../../shared/supabase.js';

export const attendanceRoutes = Router();

// Registro de Ponto Digital com validação de GPS
attendanceRoutes.post('/check-in', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      idf_colaborador,
      idf_turno,
      tpo_registro,
      num_latitude,
      num_longitude,
      des_endereco,
      flg_gps_validado
    } = req.body;

    if (!idf_colaborador) {
      res.status(400).json({ error: 'Idf_Colaborador é obrigatório.' });
      return;
    }

    // Salva o registro na TAB_Registro_Ponto
    const { data: registro, error: erroPonto } = await supabaseAdmin
      .from('TAB_Registro_Ponto')
      .insert({
        Idf_Colaborador: idf_colaborador,
        Idf_Turno: idf_turno || null,
        Tpo_Registro: tpo_registro || 'entrada',
        Num_Latitude: num_latitude || null,
        Num_Longitude: num_longitude || null,
        Des_Endereco: des_endereco || 'Localização capturada',
        Flg_Gps_Validado: flg_gps_validado ?? true
      })
      .select()
      .single();

    if (erroPonto) {
      res.status(500).json({ error: erroPonto.message });
      return;
    }

    // Se houver turno associado, atualiza o status de presença para 'present'
    if (idf_turno) {
      await supabaseAdmin
        .from('TAB_Escala_Turno')
        .update({ Tpo_Status_Presenca: 'present' })
        .eq('Idf_Turno', idf_turno);
    }

    res.status(201).json({
      success: true,
      message: 'Ponto registrado com sucesso!',
      registro
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
