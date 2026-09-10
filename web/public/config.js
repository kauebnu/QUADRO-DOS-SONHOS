// Configuração em tempo de execução.
// Em produção este arquivo é reescrito pelo entrypoint do container
// (deploy/docker-entrypoint.sh) a partir das variáveis de ambiente.
// Em desenvolvimento, os valores vêm do .env do Vite.
window.__WE_DREAM_CONFIG__ = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  vapidPublicKey: '',
  pushApiUrl: '',
}
