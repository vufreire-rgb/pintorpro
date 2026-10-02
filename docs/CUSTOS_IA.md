# Custos de áudio e IA — modelo de cálculo

> Criado em 2026-10-02. **Preços mudam**: reconferir nos sites antes de decidir. Câmbio usado: US$ 1 = R$ 5,22 (fechamento de 01/10/2026).

## Preços usados (USD)
| Item | Preço | Observação |
|---|---|---|
| Transcrição — modelo "mini" | 0,003 / min | menor custo; qualidade a validar com fala real de obra |
| Transcrição — Whisper / gpt-4o-transcribe | 0,006 / min | padrão |
| Transcrição com separação de vozes | 0,017 / min | não previsto no começo |
| Claude Sonnet 5.5 | 2 entrada / 10 saída por 1 M tokens | extração do orçamento |
| Claude Haiku 4.5 | 1 / 5 por 1 M tokens | alternativa mais barata (testar qualidade) |
| Supabase Pro | 25 / mês | 100 GB de arquivos inclusos, depois 0,021/GB; 250 GB de tráfego |
| Vercel Pro | 20 / mês por pessoa | **Hobby é proibido para uso comercial**; limite de 4,5 MB por requisição |

## Premissas (a ajustar com dados reais)
- Conversa: 140 palavras/min, 1,6 token/palavra (português) → ~224 tokens/min de transcrição.
- Extração: ~3.000 tokens de instruções+catálogo na entrada e ~3.000 tokens de saída (JSON + raciocínio).
- Áudio WAV 16 kHz mono = 1,92 MB/min; áudio compactado (~32 kbps) = 0,24 MB/min.
- Taxa de cobrança do gateway: 4% (suposição; confirmar).

## Custo por visita (R$)
| Duração | A: padrão + Sonnet | B: mini + Sonnet | C: mini + Haiku |
|---|---|---|---|
| 10 min | 0,52 | 0,37 | 0,26 |
| 20 min | 0,86 | 0,55 | 0,43 |
| 40 min | 1,53 | 0,91 | 0,77 |

## Custo mensal por pintor (visitas de 20 min)
| Visitas/mês | A | B | C |
|---|---|---|---|
| 8 | 6,9 | 4,4 | 3,4 |
| 20 | 17,2 | 11,0 | 8,6 |
| 40 | 34,4 | 21,9 | 17,2 |

Receita por pintor: R$ 29,90/mês. **No uso pesado com a opção A o custo de IA passa da receita.**

## Armazenamento
| Duração | WAV | Compactado |
|---|---|---|
| 20 min | 38 MB | 4,8 MB |
| 40 min | 77 MB | 9,6 MB |

Acúmulo (20 visitas/mês × 20 min): WAV ≈ 9,2 GB/pintor/ano; compactado ≈ 1,2 GB/pintor/ano.
1.000 pintores após 1 ano: WAV ≈ R$ 1.010/mês; compactado ≈ R$ 126/mês (acima dos 100 GB inclusos no Pro).

## Custos fixos mensais
Supabase Pro ≈ R$ 130 + Vercel Pro ≈ R$ 104 = **≈ R$ 235** (+ domínio).

## Ponto de equilíbrio (R$ 29,90, 4% de taxa, fixo R$ 235)
| Cenário | Custo de IA | Sobra/pintor | Pintores para pagar o fixo |
|---|---|---|---|
| B, 8 visitas | 4,4 | 24,3 | ≈ 10 |
| B, 20 visitas | 11,0 | 17,7 | ≈ 13 |
| B, 40 visitas | 22,0 | 6,7 | ≈ 35 |
| C, 20 visitas | 8,6 | 20,1 | ≈ 12 |
| C, 40 visitas | 17,2 | 11,5 | ≈ 20 |

## Controles de custo previstos
1. Transcrever **só quando o pintor pedir** (botão), não automaticamente.
2. **Franquia de minutos por conta** (ex.: 200 min/mês ≈ 10 visitas de 20 min ≈ R$ 5,50 de IA na opção B) e minutos extras pagos.
3. Guardar áudio **compactado**; apagar o áudio após N dias (política a definir) mantendo o texto.
4. Começar pelo modelo "mini" e medir erro com fala real; subir de nível só se necessário.
5. Reaproveitar instruções fixas da IA com cache de prompt; não reenviar transcrição à toa.
6. Limite de requisições por conta para evitar abuso/loops.

## Em aberto
- Qualidade real da transcrição em obra (barulho, duas vozes) → medir.
- Preço final do plano: franquia incluída vs. uso livre.
- LGPD: aviso/consentimento, retenção e provedor que não treine com os dados → revisão jurídica.
