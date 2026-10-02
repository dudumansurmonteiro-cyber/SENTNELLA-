-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "plano" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "setor" TEXT NOT NULL,
    "erp" TEXT NOT NULL,
    "erpIntegrado" BOOLEAN NOT NULL DEFAULT false,
    "canais" TEXT[],
    "multaPct" DOUBLE PRECISION,
    "jurosMesPct" DOUBLE PRECISION,
    "alcadaDescontoMaxPct" DOUBLE PRECISION NOT NULL,
    "alcadaParcelasMax" INTEGER NOT NULL,
    "alcadaPrazoMaxDias" INTEGER NOT NULL,
    "alcadaValorSempreAnalista" INTEGER NOT NULL,
    "valorLimiteLigacao" INTEGER NOT NULL,
    "analistaNomeado" TEXT,
    "pixChave" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lojista" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cidade" TEXT NOT NULL DEFAULT '',
    "cnpj" TEXT NOT NULL,
    "contatoNome" TEXT NOT NULL DEFAULT '',
    "contatoPapel" TEXT NOT NULL DEFAULT 'financeiro',
    "whatsapp" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "telefone" TEXT NOT NULL DEFAULT '',
    "token" TEXT NOT NULL,
    "naoCobrar" BOOLEAN NOT NULL DEFAULT false,
    "horasRespostaMedia" DOUBLE PRECISION,
    "ratingLetra" TEXT,
    "ratingTotal" INTEGER,
    "ratingDetalhe" JSONB,
    "ratingNovo" BOOLEAN NOT NULL DEFAULT true,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lojista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Titulo" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "lojistaId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "emissao" DATE NOT NULL,
    "vencimento" DATE NOT NULL,
    "antecipado" BOOLEAN NOT NULL DEFAULT false,
    "estado" TEXT NOT NULL DEFAULT 'a vencer',
    "pagoEm" DATE,
    "valorPagoCentavos" INTEGER,
    "origem" TEXT NOT NULL DEFAULT 'csv',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Titulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcaoCobranca" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tituloId" TEXT NOT NULL,
    "lojistaId" TEXT NOT NULL,
    "etapa" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "quem" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "dataProgramada" DATE NOT NULL,
    "tentativa" INTEGER NOT NULL DEFAULT 1,
    "estado" TEXT NOT NULL DEFAULT 'agendada',
    "resultado" TEXT,
    "mensagemRenderizada" TEXT,
    "motivoBloqueio" TEXT,
    "executadaEm" TIMESTAMP(3),

    CONSTRAINT "AcaoCobranca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensagem" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "lojistaId" TEXT NOT NULL,
    "tituloId" TEXT,
    "acaoId" TEXT,
    "excecaoId" TEXT,
    "canal" TEXT NOT NULL,
    "de" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "entrega" TEXT,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Excecao" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "lojistaId" TEXT NOT NULL,
    "tituloId" TEXT,
    "motivo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'aberta',
    "slaMin" INTEGER NOT NULL,
    "valorEnvolvidoCentavos" INTEGER NOT NULL DEFAULT 0,
    "abertaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assumidaPor" TEXT,
    "assumidaEm" TIMESTAMP(3),
    "causa" TEXT,
    "resolucao" TEXT,
    "regraSugerida" TEXT,

    CONSTRAINT "Excecao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Acordo" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "lojistaId" TEXT NOT NULL,
    "valorTotalCentavos" INTEGER NOT NULL,
    "parcelas" INTEGER NOT NULL,
    "parcelasPagas" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'em dia',
    "origem" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Acordo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcordoTitulo" (
    "acordoId" TEXT NOT NULL,
    "tituloId" TEXT NOT NULL,

    CONSTRAINT "AcordoTitulo_pkey" PRIMARY KEY ("acordoId","tituloId")
);

-- CreateTable
CREATE TABLE "Autorizacao" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "lojistaId" TEXT NOT NULL,
    "tituloId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "pedidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "aprovadaEm" TIMESTAMP(3),

    CONSTRAINT "Autorizacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promessa" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "lojistaId" TEXT NOT NULL,
    "tituloId" TEXT NOT NULL,
    "para" DATE NOT NULL,
    "cumprida" BOOLEAN,
    "origem" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promessa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagamentoInformado" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "lojistaId" TEXT NOT NULL,
    "tituloId" TEXT NOT NULL,
    "observacao" TEXT,
    "conferido" BOOLEAN NOT NULL DEFAULT false,
    "informadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagamentoInformado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroAuditoria" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "de" TEXT,
    "para" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "detalhe" TEXT,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lojista_token_key" ON "Lojista"("token");

-- CreateIndex
CREATE INDEX "Lojista_clienteId_idx" ON "Lojista"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "Lojista_clienteId_cnpj_key" ON "Lojista"("clienteId", "cnpj");

-- CreateIndex
CREATE INDEX "Titulo_clienteId_estado_idx" ON "Titulo"("clienteId", "estado");

-- CreateIndex
CREATE INDEX "Titulo_clienteId_vencimento_idx" ON "Titulo"("clienteId", "vencimento");

-- CreateIndex
CREATE UNIQUE INDEX "Titulo_clienteId_numero_key" ON "Titulo"("clienteId", "numero");

-- CreateIndex
CREATE INDEX "AcaoCobranca_clienteId_dataProgramada_estado_idx" ON "AcaoCobranca"("clienteId", "dataProgramada", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "AcaoCobranca_tituloId_etapa_canal_tentativa_key" ON "AcaoCobranca"("tituloId", "etapa", "canal", "tentativa");

-- CreateIndex
CREATE INDEX "Mensagem_clienteId_lojistaId_em_idx" ON "Mensagem"("clienteId", "lojistaId", "em");

-- CreateIndex
CREATE INDEX "Mensagem_excecaoId_idx" ON "Mensagem"("excecaoId");

-- CreateIndex
CREATE INDEX "Excecao_clienteId_estado_idx" ON "Excecao"("clienteId", "estado");

-- CreateIndex
CREATE INDEX "Acordo_clienteId_status_idx" ON "Acordo"("clienteId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AcordoTitulo_tituloId_key" ON "AcordoTitulo"("tituloId");

-- CreateIndex
CREATE INDEX "Autorizacao_clienteId_status_idx" ON "Autorizacao"("clienteId", "status");

-- CreateIndex
CREATE INDEX "Promessa_clienteId_para_idx" ON "Promessa"("clienteId", "para");

-- CreateIndex
CREATE INDEX "RegistroAuditoria_clienteId_em_idx" ON "RegistroAuditoria"("clienteId", "em");

-- CreateIndex
CREATE INDEX "RegistroAuditoria_entidade_entidadeId_idx" ON "RegistroAuditoria"("entidade", "entidadeId");

-- AddForeignKey
ALTER TABLE "Lojista" ADD CONSTRAINT "Lojista_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Titulo" ADD CONSTRAINT "Titulo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Titulo" ADD CONSTRAINT "Titulo_lojistaId_fkey" FOREIGN KEY ("lojistaId") REFERENCES "Lojista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcaoCobranca" ADD CONSTRAINT "AcaoCobranca_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcaoCobranca" ADD CONSTRAINT "AcaoCobranca_tituloId_fkey" FOREIGN KEY ("tituloId") REFERENCES "Titulo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcaoCobranca" ADD CONSTRAINT "AcaoCobranca_lojistaId_fkey" FOREIGN KEY ("lojistaId") REFERENCES "Lojista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_lojistaId_fkey" FOREIGN KEY ("lojistaId") REFERENCES "Lojista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Excecao" ADD CONSTRAINT "Excecao_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Excecao" ADD CONSTRAINT "Excecao_lojistaId_fkey" FOREIGN KEY ("lojistaId") REFERENCES "Lojista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Excecao" ADD CONSTRAINT "Excecao_tituloId_fkey" FOREIGN KEY ("tituloId") REFERENCES "Titulo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acordo" ADD CONSTRAINT "Acordo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acordo" ADD CONSTRAINT "Acordo_lojistaId_fkey" FOREIGN KEY ("lojistaId") REFERENCES "Lojista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcordoTitulo" ADD CONSTRAINT "AcordoTitulo_acordoId_fkey" FOREIGN KEY ("acordoId") REFERENCES "Acordo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcordoTitulo" ADD CONSTRAINT "AcordoTitulo_tituloId_fkey" FOREIGN KEY ("tituloId") REFERENCES "Titulo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Autorizacao" ADD CONSTRAINT "Autorizacao_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Autorizacao" ADD CONSTRAINT "Autorizacao_lojistaId_fkey" FOREIGN KEY ("lojistaId") REFERENCES "Lojista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Autorizacao" ADD CONSTRAINT "Autorizacao_tituloId_fkey" FOREIGN KEY ("tituloId") REFERENCES "Titulo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promessa" ADD CONSTRAINT "Promessa_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promessa" ADD CONSTRAINT "Promessa_lojistaId_fkey" FOREIGN KEY ("lojistaId") REFERENCES "Lojista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promessa" ADD CONSTRAINT "Promessa_tituloId_fkey" FOREIGN KEY ("tituloId") REFERENCES "Titulo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagamentoInformado" ADD CONSTRAINT "PagamentoInformado_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagamentoInformado" ADD CONSTRAINT "PagamentoInformado_lojistaId_fkey" FOREIGN KEY ("lojistaId") REFERENCES "Lojista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagamentoInformado" ADD CONSTRAINT "PagamentoInformado_tituloId_fkey" FOREIGN KEY ("tituloId") REFERENCES "Titulo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAuditoria" ADD CONSTRAINT "RegistroAuditoria_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
