const patch = require('path');
const { Pool } = require('pg');

const app = express();
// Render nos asignará un puerto automático, si no, usamos el 3000 localmente
const PORT = process.env.PORT || 3000;

// Configuración de la conexión a Neon usando la variable de entorno
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Requerido para conexiones seguras con Neon/Render
  }
});

// Ruta principal de prueba
app.get('/', (req, res) => {
  res.send('🌍 El servidor de mapas está en línea y conectado a Neon.');
});

// Servir los archivos estáticos de la carpeta 'public' (como el index.html)
app.use(express.static(path.join(__dirname, 'public')));

// Al entrar a la raíz, enviar el mapa interactivo
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Arrancar el servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});