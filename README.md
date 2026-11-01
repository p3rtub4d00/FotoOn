# FotoOn

Protótipo inicial da experiência do cliente para pedidos de impressão de fotos. Interface responsiva com identidade visual em preto, branco e laranja.

## Estado atual

- Página inicial do cliente e fluxo de seleção de fotos.
- Seleção local de arquivos JPG, PNG e WEBP (até 15 MB por arquivo; até 100 fotos por pedido).
- Seleção demonstrativa de formatos 10×15, 15×21 e 20×30 cm.
- Preços de exemplo editáveis no arquivo `app.js`, armazenados em centavos.
- Pedido de demonstração salvo no `localStorage` do navegador.
- Pagamento real desativado: nenhuma cobrança, QR Code Pix ou transação com cartão é criada.
- Impressão física desativada: nenhum trabalho é enviado a uma impressora.
- A opção de “melhoria” é apenas um aviso demonstrativo; não há processamento por IA real.
- As imagens selecionadas permanecem no navegador e não são enviadas para um servidor.

## Executar localmente

Como esta etapa é uma página estática, abra `index.html` no navegador ou inicie um servidor estático na pasta:

```bash
npx serve .
```

## Publicar no Render

Crie um **Static Site** apontando para este repositório. Não é necessário configurar banco de dados nem variáveis de pagamento nesta etapa. O diretório de publicação é a raiz do repositório.

## Antes de produção

1. Implementar API e armazenamento privado para imagens; não usar o navegador como armazenamento definitivo.
2. Implementar autenticação e painel administrativo protegido.
3. Configurar preços e taxas no servidor, nunca confiar em valores enviados pelo navegador.
4. Implementar processamento de imagem real e comparação entre original e versão processada.
5. Implementar integração de pagamento e confirmação por webhook idempotente.
6. Criar fila de impressão persistente e agente local da impressora.
7. Validar modelo/driver/papel, qualidade e corte com testes supervisionados.
8. Definir e testar política de retenção e exclusão dos arquivos.

**Aviso:** este protótipo não é um sistema de pedidos pronto para uso comercial. Os preços exibidos são exemplos e o fluxo não realiza pagamento ou impressão.
