# FotoOn

Sistema web para pedidos de impressão fotográfica, com área do cliente e painel administrativo.

## Recursos implementados

- Página pública responsiva para seleção de fotos.
- API Node/Express para receber e armazenar fotos no servidor.
- Cadastro de pedido com nome, telefone, tamanho, quantidade, retirada/entrega e observações.
- Cálculo de preços no servidor, com valores configuráveis pelo painel.
- Painel administrativo em `/admin`, protegido por senha configurada no ambiente.
- Sessão em cookie assinado/HttpOnly, limite de tentativas de login e cabeçalhos de segurança.
- Gestão de pedidos e atualização manual de status.
- Configuração de preços, taxa de entrega e modalidades disponíveis.
- Pagamento em modo de simulação, sem Pix real ou cobrança.
- Impressão física e impressão automática desativadas.

## Executar localmente

Requer Node.js 20 ou superior.

```bash
npm install
ADMIN_PASSWORD="uma-senha-local-forte" SESSION_SECRET="uma-chave-aleatoria-longa" npm start
```

Abra `http://localhost:3000` e o painel em `http://localhost:3000/admin`.

## Publicar no Render

Esta versão exige **Web Service**, não Static Site.

1. Crie um Web Service conectado ao repositório `p3rtub4d00/FotoOn`.
2. Build Command: `npm install`.
3. Start Command: `npm start`.
4. Configure `ADMIN_PASSWORD`, `SESSION_SECRET`, `NODE_ENV=production` e `DATA_DIR=/var/data`.
5. Configure um Persistent Disk montado em `/var/data`. O arquivo `render.yaml` sugere plano Starter e disco de 10 GB; confirme custos e disponibilidade no painel antes de criar.
6. Use uma senha forte e um segredo aleatório longo e exclusivo para `SESSION_SECRET`.

## Limitações antes do uso comercial

- A melhoria por IA ainda não foi implementada; a opção de demonstração não altera as imagens.
- Pagamento é apenas simulado; não há integração Mercado Pago, QR Pix real ou webhook.
- Impressão permanece desativada; não há agente local nem comunicação com impressora USB.
- O armazenamento JSON é adequado apenas para um MVP de baixo volume e não tem as garantias de um banco de dados. Para operação comercial, migrar pedidos/configurações para banco de dados e fotos para armazenamento de objetos.
- Validar segurança de upload, qualidade/corte, retenção e exclusão de imagens, privacidade/LGPD e backups.
- Web Service e disco persistente do Render podem gerar custos; confira os valores atuais antes de publicar.

**Importante:** não publique antes de configurar senha/segredo e disco persistente. Nenhuma cobrança real nem impressão será disparada por este código.
