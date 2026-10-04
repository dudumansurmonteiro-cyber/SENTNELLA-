-- CreateTable
CREATE TABLE "Escritorio" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "oab" TEXT NOT NULL DEFAULT '',
    "cidade" TEXT NOT NULL DEFAULT '',
    "plano" TEXT NOT NULL,
    "marcaNome" TEXT NOT NULL,
    "marcaIniciais" TEXT NOT NULL DEFAULT '',
    "corPrimaria" TEXT NOT NULL DEFAULT '#0E4A45',
    "corClara" TEXT NOT NULL DEFAULT '#7FB3AC',
    "mostrarOperadora" BOOLEAN NOT NULL DEFAULT true,
    "whatsappNumero" TEXT NOT NULL DEFAULT '',
    "slaMin" INTEGER,
    "retencaoGravacoesAnos" INTEGER NOT NULL DEFAULT 5,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Escritorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioEscritorio" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "oab" TEXT,

    CONSTRAINT "UsuarioEscritorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credor" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "setor" TEXT NOT NULL,
    "contatoNome" TEXT NOT NULL DEFAULT '',
    "honorariosPct" DOUBLE PRECISION,
    "token" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Credor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Carteira" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "credorId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "devedoresTipo" TEXT NOT NULL DEFAULT 'PF e PJ',
    "descontoMaxPct" DOUBLE PRECISION NOT NULL,
    "parcelasMax" INTEGER NOT NULL,
    "prazoMaxDias" INTEGER NOT NULL,
    "entradaMinPct" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "canais" TEXT[],
    "multaPct" DOUBLE PRECISION,
    "jurosMesPct" DOUBLE PRECISION,
    "baseLegal" TEXT NOT NULL DEFAULT 'execução de contrato',
    "controlador" TEXT NOT NULL DEFAULT 'credor',
    "contaEmissora" TEXT NOT NULL DEFAULT 'conta do credor',
    "reguaPerfil" TEXT NOT NULL DEFAULT 'padrão',
    "entradaEm" DATE NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Carteira_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Devedor" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "credorId" TEXT NOT NULL,
    "carteiraId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "cidade" TEXT NOT NULL DEFAULT '',
    "whatsapp" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "telefone" TEXT NOT NULL DEFAULT '',
    "telefoneTrabalho" TEXT NOT NULL DEFAULT '',
    "token" TEXT NOT NULL,
    "canaisBloqueados" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "naoContatar" BOOLEAN NOT NULL DEFAULT false,
    "vulneravel" BOOLEAN NOT NULL DEFAULT false,
    "naoCobrar" BOOLEAN NOT NULL DEFAULT false,
    "ratingLetra" TEXT,
    "ratingTotal" INTEGER,
    "ratingDetalhe" JSONB,
    "ratingNovo" BOOLEAN NOT NULL DEFAULT true,
    "horasRespostaMedia" DOUBLE PRECISION,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Devedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Titulo" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "credorId" TEXT NOT NULL,
    "carteiraId" TEXT NOT NULL,
    "devedorId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "vencimento" DATE NOT NULL,
    "entradaCarteira" DATE NOT NULL,
    "atrasoOriginal" INTEGER NOT NULL,
    "antecipado" BOOLEAN NOT NULL DEFAULT false,
    "estado" TEXT NOT NULL DEFAULT 'em cobrança',
    "contestadoEm" TIMESTAMP(3),
    "contestacaoMotivo" TEXT,
    "comunicacaoPreviaEnviadaEm" DATE,
    "comunicacaoPreviaProva" TEXT,
    "pagoEm" DATE,
    "valorPagoCentavos" INTEGER,
    "origem" TEXT NOT NULL DEFAULT 'csv',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Titulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcaoCobranca" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "carteiraId" TEXT NOT NULL,
    "tituloId" TEXT NOT NULL,
    "devedorId" TEXT NOT NULL,
    "etapa" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "quem" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "dataProgramada" DATE NOT NULL,
    "tentativa" INTEGER NOT NULL DEFAULT 1,
    "estado" TEXT NOT NULL DEFAULT 'agendada',
    "resultado" TEXT,
    "mensagemRenderizada" TEXT,
    "motivoBloqueio" TEXT,
    "marcaAtiva" TEXT NOT NULL,
    "executadaEm" TIMESTAMP(3),

    CONSTRAINT "AcaoCobranca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensagem" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "devedorId" TEXT NOT NULL,
    "tituloId" TEXT,
    "acaoId" TEXT,
    "excecaoId" TEXT,
    "canal" TEXT NOT NULL,
    "de" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "entrega" TEXT,
    "marcaAtiva" TEXT NOT NULL,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Excecao" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "devedorId" TEXT NOT NULL,
    "tituloId" TEXT,
    "motivo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'aberta',
    "slaMin" INTEGER,
    "valorEnvolvidoCentavos" INTEGER NOT NULL DEFAULT 0,
    "abertaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assumidaPor" TEXT,
    "assumidaEm" TIMESTAMP(3),
    "causa" TEXT,
    "resolucao" TEXT,

    CONSTRAINT "Excecao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Acordo" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "devedorId" TEXT NOT NULL,
    "valorTotalCentavos" INTEGER NOT NULL,
    "jurosEmbutidosCentavos" INTEGER NOT NULL DEFAULT 0,
    "parcelas" INTEGER NOT NULL,
    "parcelasPagas" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'em dia',
    "origem" TEXT NOT NULL,
    "custoTotalAceitoEm" TIMESTAMP(3),
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
CREATE TABLE "DocumentoJuridico" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "devedorId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "subtipo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pronto',
    "valorCentavos" INTEGER NOT NULL DEFAULT 0,
    "modelo" TEXT,
    "assinadoPor" TEXT,
    "assinadoEm" TIMESTAMP(3),
    "provaEnvio" TEXT,
    "conteudo" JSONB,
    "marcaAtiva" TEXT NOT NULL,
    "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoJuridico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoTitulo" (
    "documentoId" TEXT NOT NULL,
    "tituloId" TEXT NOT NULL,

    CONSTRAINT "DocumentoTitulo_pkey" PRIMARY KEY ("documentoId","tituloId")
);

-- CreateTable
CREATE TABLE "Promessa" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "devedorId" TEXT NOT NULL,
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
    "escritorioId" TEXT NOT NULL,
    "devedorId" TEXT NOT NULL,
    "tituloId" TEXT NOT NULL,
    "observacao" TEXT,
    "conferido" BOOLEAN NOT NULL DEFAULT false,
    "informadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagamentoInformado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroAuditoria" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
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
CREATE INDEX "UsuarioEscritorio_escritorioId_idx" ON "UsuarioEscritorio"("escritorioId");

-- CreateIndex
CREATE UNIQUE INDEX "Credor_token_key" ON "Credor"("token");

-- CreateIndex
CREATE INDEX "Credor_escritorioId_idx" ON "Credor"("escritorioId");

-- CreateIndex
CREATE INDEX "Carteira_escritorioId_idx" ON "Carteira"("escritorioId");

-- CreateIndex
CREATE INDEX "Carteira_credorId_idx" ON "Carteira"("credorId");

-- CreateIndex
CREATE UNIQUE INDEX "Devedor_token_key" ON "Devedor"("token");

-- CreateIndex
CREATE INDEX "Devedor_escritorioId_idx" ON "Devedor"("escritorioId");

-- CreateIndex
CREATE INDEX "Devedor_carteiraId_idx" ON "Devedor"("carteiraId");

-- CreateIndex
CREATE UNIQUE INDEX "Devedor_carteiraId_documento_key" ON "Devedor"("carteiraId", "documento");

-- CreateIndex
CREATE INDEX "Titulo_escritorioId_estado_idx" ON "Titulo"("escritorioId", "estado");

-- CreateIndex
CREATE INDEX "Titulo_carteiraId_estado_idx" ON "Titulo"("carteiraId", "estado");

-- CreateIndex
CREATE INDEX "Titulo_escritorioId_entradaCarteira_idx" ON "Titulo"("escritorioId", "entradaCarteira");

-- CreateIndex
CREATE UNIQUE INDEX "Titulo_carteiraId_numero_key" ON "Titulo"("carteiraId", "numero");

-- CreateIndex
CREATE INDEX "AcaoCobranca_escritorioId_dataProgramada_estado_idx" ON "AcaoCobranca"("escritorioId", "dataProgramada", "estado");

-- CreateIndex
CREATE INDEX "AcaoCobranca_carteiraId_dataProgramada_idx" ON "AcaoCobranca"("carteiraId", "dataProgramada");

-- CreateIndex
CREATE UNIQUE INDEX "AcaoCobranca_tituloId_etapa_canal_tentativa_key" ON "AcaoCobranca"("tituloId", "etapa", "canal", "tentativa");

-- CreateIndex
CREATE INDEX "Mensagem_escritorioId_devedorId_em_idx" ON "Mensagem"("escritorioId", "devedorId", "em");

-- CreateIndex
CREATE INDEX "Mensagem_excecaoId_idx" ON "Mensagem"("excecaoId");

-- CreateIndex
CREATE INDEX "Excecao_escritorioId_estado_idx" ON "Excecao"("escritorioId", "estado");

-- CreateIndex
CREATE INDEX "Acordo_escritorioId_status_idx" ON "Acordo"("escritorioId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AcordoTitulo_tituloId_key" ON "AcordoTitulo"("tituloId");

-- CreateIndex
CREATE INDEX "DocumentoJuridico_escritorioId_status_idx" ON "DocumentoJuridico"("escritorioId", "status");

-- CreateIndex
CREATE INDEX "DocumentoJuridico_devedorId_idx" ON "DocumentoJuridico"("devedorId");

-- CreateIndex
CREATE INDEX "DocumentoTitulo_tituloId_idx" ON "DocumentoTitulo"("tituloId");

-- CreateIndex
CREATE INDEX "Promessa_escritorioId_para_idx" ON "Promessa"("escritorioId", "para");

-- CreateIndex
CREATE INDEX "RegistroAuditoria_escritorioId_em_idx" ON "RegistroAuditoria"("escritorioId", "em");

-- CreateIndex
CREATE INDEX "RegistroAuditoria_entidade_entidadeId_idx" ON "RegistroAuditoria"("entidade", "entidadeId");

-- AddForeignKey
ALTER TABLE "UsuarioEscritorio" ADD CONSTRAINT "UsuarioEscritorio_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credor" ADD CONSTRAINT "Credor_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carteira" ADD CONSTRAINT "Carteira_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carteira" ADD CONSTRAINT "Carteira_credorId_fkey" FOREIGN KEY ("credorId") REFERENCES "Credor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devedor" ADD CONSTRAINT "Devedor_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devedor" ADD CONSTRAINT "Devedor_credorId_fkey" FOREIGN KEY ("credorId") REFERENCES "Credor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devedor" ADD CONSTRAINT "Devedor_carteiraId_fkey" FOREIGN KEY ("carteiraId") REFERENCES "Carteira"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Titulo" ADD CONSTRAINT "Titulo_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Titulo" ADD CONSTRAINT "Titulo_credorId_fkey" FOREIGN KEY ("credorId") REFERENCES "Credor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Titulo" ADD CONSTRAINT "Titulo_carteiraId_fkey" FOREIGN KEY ("carteiraId") REFERENCES "Carteira"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Titulo" ADD CONSTRAINT "Titulo_devedorId_fkey" FOREIGN KEY ("devedorId") REFERENCES "Devedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcaoCobranca" ADD CONSTRAINT "AcaoCobranca_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcaoCobranca" ADD CONSTRAINT "AcaoCobranca_carteiraId_fkey" FOREIGN KEY ("carteiraId") REFERENCES "Carteira"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcaoCobranca" ADD CONSTRAINT "AcaoCobranca_tituloId_fkey" FOREIGN KEY ("tituloId") REFERENCES "Titulo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcaoCobranca" ADD CONSTRAINT "AcaoCobranca_devedorId_fkey" FOREIGN KEY ("devedorId") REFERENCES "Devedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_devedorId_fkey" FOREIGN KEY ("devedorId") REFERENCES "Devedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Excecao" ADD CONSTRAINT "Excecao_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Excecao" ADD CONSTRAINT "Excecao_devedorId_fkey" FOREIGN KEY ("devedorId") REFERENCES "Devedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Excecao" ADD CONSTRAINT "Excecao_tituloId_fkey" FOREIGN KEY ("tituloId") REFERENCES "Titulo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acordo" ADD CONSTRAINT "Acordo_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acordo" ADD CONSTRAINT "Acordo_devedorId_fkey" FOREIGN KEY ("devedorId") REFERENCES "Devedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcordoTitulo" ADD CONSTRAINT "AcordoTitulo_acordoId_fkey" FOREIGN KEY ("acordoId") REFERENCES "Acordo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcordoTitulo" ADD CONSTRAINT "AcordoTitulo_tituloId_fkey" FOREIGN KEY ("tituloId") REFERENCES "Titulo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoJuridico" ADD CONSTRAINT "DocumentoJuridico_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoJuridico" ADD CONSTRAINT "DocumentoJuridico_devedorId_fkey" FOREIGN KEY ("devedorId") REFERENCES "Devedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoTitulo" ADD CONSTRAINT "DocumentoTitulo_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoJuridico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoTitulo" ADD CONSTRAINT "DocumentoTitulo_tituloId_fkey" FOREIGN KEY ("tituloId") REFERENCES "Titulo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promessa" ADD CONSTRAINT "Promessa_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promessa" ADD CONSTRAINT "Promessa_devedorId_fkey" FOREIGN KEY ("devedorId") REFERENCES "Devedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promessa" ADD CONSTRAINT "Promessa_tituloId_fkey" FOREIGN KEY ("tituloId") REFERENCES "Titulo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagamentoInformado" ADD CONSTRAINT "PagamentoInformado_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagamentoInformado" ADD CONSTRAINT "PagamentoInformado_devedorId_fkey" FOREIGN KEY ("devedorId") REFERENCES "Devedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagamentoInformado" ADD CONSTRAINT "PagamentoInformado_tituloId_fkey" FOREIGN KEY ("tituloId") REFERENCES "Titulo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAuditoria" ADD CONSTRAINT "RegistroAuditoria_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
