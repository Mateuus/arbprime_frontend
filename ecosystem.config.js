module.exports = {
    apps: [
      {
        name: "arbcrypto_frontend",             // Nome da aplicação para identificação no PM2
        script: "npm",                          // Usa o npm para iniciar o Next.js
        args: "start",                          // Comando que o PM2 executará, equivalente a 'npm start'
        env: {
          PORT: 4000,                           // Define a porta 4000 para o Next.js
          NODE_ENV: "production"                // Define o ambiente como produção
        },
        interpreter: "node",                    // Interprete para executar o Node.js
        instances: 1,                           // Número de instâncias (para SSR, geralmente 1 é suficiente)
        exec_mode: "fork",                      // Modo de execução "fork" para processos individuais
        autorestart: true,                      // Reinicia automaticamente em caso de falha
        watch: false,                           // Desativa o watch em produção para evitar reinicializações desnecessárias
        max_memory_restart: "3G"                // Reinicia o processo se ele usar mais de 1GB de memória
      }
    ]
  };
  