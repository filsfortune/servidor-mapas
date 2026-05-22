const express = require('express');
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

// RUTA CRUCIAL: Devuelve tu provincia en formato GeoJSON para tu mapa web
app.get('/api/mapa', async (req, res) => {
  try {
    // Consulta corregida con la tabla Lahabanap, y columnas fid y geom
    const queryText = `
      SELECT jsonb_build_object(
        'type', 'FeatureCollection',
        'features', jsonb_agg(feature)
      ) FROM (
        SELECT jsonb_build_object(
          'type', 'Feature',
          'id', fid,
          'geometry', ST_AsGeoJSON(geom)::jsonb,
          'properties', to_jsonb(inputs) - 'geom'
        ) AS feature
        FROM (SELECT * FROM public.provincia_lahabana) inputs
      ) features;
    `;

    const result = await pool.query(queryText);
    
    // Permitir que cualquier página web consulte este mapa (CORS básico)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(result.rows[0].jsonb_build_object);

  } catch (err) {
    console.error('Error al consultar el mapa en Neon:', err);
    res.status(500).json({ error: 'Error interno del servidor al cargar el mapa' });
  }
});

// Arrancar el servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});