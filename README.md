# IrrigaSense 2.0 — Site para GitHub Pages

Arquivos principais:

- `index.html`
- `styles.css`
- `app.js`

## Como publicar

Envie os três arquivos para a raiz do seu repositório GitHub.

Depois:

Settings → Pages → Deploy from a branch → main → /(root) → Save

## Senhas de demonstração

- Modo manual: `admnistrador231`
- Painel do Administrador: `IrrigaAdmin2026`

Essas senhas são apenas para demonstração local. Em produção, o Painel do Administrador deve usar Firebase Authentication.

## O que já funciona nesta versão

- Menu responsivo
- 2 zonas
- 21 culturas + personalizada
- Presets automáticos de umidade
- Proteção noturna configurável
- Modo manual com 5s, 10s, 15s, 20s, 25s, 30s, 45s e 60s
- Contagem regressiva e parada imediata
- Histórico
- Gráficos demonstrativos
- Perfis
- Calibração
- Conectividade
- Telegram
- Galeria
- Painel do Administrador
- Alteração da senha do modo manual
- Alteração da senha administrativa
- Central de Ajuda com Assistente IrrigaSense

## O que ainda será conectado depois

- Firebase Realtime Database
- Firebase Authentication
- Firebase Storage
- ESP-01
- Arduino Uno R3
- Confirmação de comandos
- Telegram dinâmico
- Assistente com dados reais


## Atualização — gráficos e equipe

Esta versão também inclui:
- gráfico separado da Zona 1/cultura;
- gráfico separado da Zona 2/cultura;
- gráfico de consumo estimado de água por zona;
- indicadores de litros estimados e tempo de irrigação;
- vazão estimada configurável das duas bombas pelo Painel do Administrador;
- fotos de perfil da equipe gerenciáveis pelo Painel do Administrador.

### Consumo estimado
O consumo é calculado por:
`tempo de irrigação (min) × vazão estimada da bomba (L/min)`

Até a vazão de cada bomba ser medida fisicamente, o valor exibido deve ser tratado apenas como estimativa.


## Atualização — ordenação da galeria

No Painel do Administrador, agora é possível:
- mover uma foto para cima;
- mover uma foto para baixo;
- arrastar e soltar para reorganizar;
- ver a posição atual de cada foto.

A ordem escolhida é aplicada à Galeria do Projeto e às imagens da página inicial.
