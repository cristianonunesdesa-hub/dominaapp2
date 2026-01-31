
import { GoogleGenAI } from "@google/genai";
import { Activity } from "../types";
import { CELL_AREA_M2 } from "../constants";

export const generateBattleReport = async (activity: Activity, nickname: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const stats = {
    areaCaptured: activity.capturedCellIds.size * CELL_AREA_M2,
    areaNeutralized: activity.stolenCellIds.size * CELL_AREA_M2,
    distance: (activity.distanceMeters / 1000).toFixed(2),
    durationSeconds: activity.endTime ? (activity.endTime - activity.startTime) / 1000 : 0
  };

  const prompt = `
    Gere um "Relatório de Batalha" curto, tático e de alta energia para um jogo de conquista de território chamado "Domina".
    O jogo foca em "Cercamento" (fechar loops para reivindicar área) e "Sabotagem" (caminhar por área inimiga para neutralizá-la).
    O texto DEVE ser obrigatoriamente em Português do Brasil (PT-BR).
    
    Jogador: ${nickname}
    Estatísticas:
    - Novo Território Conquistado: ${stats.areaCaptured.toLocaleString()} m²
    - Território Inimigo Neutralizado: ${stats.areaNeutralized.toLocaleString()} m²
    - Distância Percorrida: ${stats.distance} km
    
    O tom deve ser o de um comandante militar instruindo um soldado. Mencione como o jogador "sabotou as linhas inimigas" ou "garantiu um perímetro estratégico". Máximo de 250 caracteres.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Perímetro estratégico estabelecido. Território atualizado, Comandante.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Missão cumprida. Solo inimigo neutralizado. Grid atualizado.";
  }
};
