const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors'); // 1. REQUERIR EL PAQUETE CORS (Añade esta línea)

const app = express();
const PORT = process.env.PORT || 3000;

// 2. HABILITAR CORS PARA CUALQUIER ORIGEN (Añade esta línea crucial)
app.use(cors()); 
app.use(express.json());

// Configuración de la conexión a Neon usando la variable de entorno
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Servir los archivos estáticos de la carpeta principal (raíz) o public si tienes estilos
app.use(express.static(path.join(__dirname, './')));

// 1. Ruta principal de prueba
app.get('/', (req, res) => {
  res.send('🌍 El servidor de mapas está en línea y conectado a Neon.');
});

// 2. RUTA DE LA PROVINCIA (La que ya te funciona)
app.get('/api/mapa', async (req, res) => {
  try {
    const result = await pool.query('SELECT ST_AsGeoJSON(geom)::json as geometry FROM provincia_lahabana');
    const geojson = {
      type: "FeatureCollection",
      features: result.rows.map(row => ({
        type: "Feature",
        geometry: row.geometry,
        properties: {}
      }))
    };
    res.json(geojson);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 3. NUEVA RUTA: DISTRITOS (Corregida y completa)
app.get('/api/distritos', async (req, res) => {
  try {
    // CORRECCIÓN: Añadimos 'fid' y 'nombre' dentro del SELECT para que la base de datos los devuelva
    const query = `
      SELECT 
        id, 
        fid, 
        nombre, 
        ST_AsGeoJSON(geom)::json as geometry 
      FROM distritos
    `;
    
    const result = await pool.query(query);
    
    const geojson = {
      type: "FeatureCollection",
      features: result.rows.map(row => ({
        type: "Feature",
        id: row.id,
        geometry: row.geometry,
        properties: {
          fid: row.fid,       // Enviamos el fid de QGIS
          nombre: row.nombre  // ¡AHORA SÍ! row.nombre tiene los datos de Neon
        }
      }))
    };
    
    res.json(geojson);
  } catch (err) {
    console.error('Error en la API de distritos:', err);
    res.status(500).json({ error: err.message });
  }
});

// RUTA POST PARA GUARDAR UN NUEVO PUNTO
app.post('/api/pois', async (req, res) => {
    const { titulo, descripcion, color, latitud, longitud } = req.body;
    
    try {
        const query = `
            INSERT INTO puntos_interes (titulo, descripcion, color, latitud, longitud) 
            VALUES ($1, $2, $3, $4, $5) 
            RETURNING *;
        `;
        const values = [titulo, descripcion, color, latitud, longitud];
        const result = await pool.query(query, values);
        
        // Es CRUCIAL devolver el punto creado con el ID que le asignó la BD
        res.status(201).json(result.rows[0]); 
    } catch (error) {
        console.error("Error al insertar en la base de datos:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// ========================================================
// RUTA 2: BORRAR UN PUNTO PERMANENTEMENTE DE NEON
// ========================================================
app.delete('/api/pois/:id', async (req, res) => {
    const { id } = req.params; // Esto lee el ID que el mapa manda en la URL (ej: /api/pois/5)

    try {
        const query = 'DELETE FROM puntos_interes WHERE id = $1;';
        const result = await pool.query(query, [id]);

        // Si la base de datos no encontró ninguna fila con ese ID
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "El marcador no existe en la base de datos." });
        }

        // Si todo sale bien, respondemos con éxito
        res.json({ mensaje: "Marcador eliminado correctamente de la base de datos cloud." });
    } catch (error) {
        console.error("Error al borrar el punto en Neon:", error);
        res.status(500).json({ error: "Error interno del servidor al eliminar el marcador" });
    }
});

// TAMBIÉN NECESITARÁS LA RUTA GET PARA LEERLOS AL REFRESCAR
app.get('/api/pois', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM puntos_interes ORDER BY fecha_creacion DESC;');
        res.json(result.rows);
    } catch (error) {
        console.error("Error al obtener puntos:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// Levantar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

// ============================================================
// GEOLOCALIZACIÓN EN TIEMPO REAL CON LEAFLET
// ============================================================

// 1. Inicializar el mapa (Asegúrate de tener un <div id="mapa-interactivo"> en tu HTML)
const mapa = L.map('mapa-interactivo').setView([40.4167, -3.7037], 13); // Coordenadas por defecto (ej. Madrid)

// Cargar las baldosas del mapa (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(mapa);

// Variables para el marcador y el círculo de precisión
let marcadorUsuario = null;
let circuloPrecision = null;

// 2. Función para rastrear la ubicación en tiempo real
function activarRastreoGPS() {
    // Verificar si el navegador soporta Geolocation
    if (!("geolocation" in navigator)) {
        alert("Tu navegador no soporta geolocalización.");
        return;
    }

    // Opciones para alta precisión
    const opcionesGps = {
        enableHighAccuracy: true, // Usa el GPS del dispositivo (mayor precisión)
        maximumAge: 0,            // No usar ubicaciones en caché
        timeout: 5000             // Tiempo máximo de espera (5 segundos)
    };

    // watchPosition escucha los cambios de ubicación en tiempo real
    navigator.geolocation.watchPosition(
        (posicion) => {
            const lat = posicion.coords.latitude;
            const lng = posicion.coords.longitude;
            const precision = posicion.coords.accuracy; // Precisión en metros

            const latlng = [lat, lng];

            // Si es la primera vez, creamos el marcador
            if (!marcadorUsuario) {
                // Marcador azul para el usuario
                marcadorUsuario = L.marker(latlng).addTo(mapa)
                    .bindPopup("<b>Estás aquí</b>").openPopup();

                // Círculo translúcido que muestra el margen de error del GPS
                circuloPrecision = L.circle(latlng, { radius: precision, color: '#007acc', opacity: 0.5 }).addTo(mapa);

                // Centrar el mapa en la ubicación del usuario
                mapa.setView(latlng, 16);
            } else {
                // Si el usuario se mueve, actualizamos las posiciones sin recrear los objetos
                marcadorUsuario.setLatLng(latlng);
                circuloPrecision.setLatLng(latlng);
                circuloPrecision.setRadius(precision);
            }
        },
        (error) => {
            console.error("Error obteniendo la geolocalización:", error.message);
        },
        opcionesGps
    );
}

// Ejecutar la geolocalización cuando cargue el módulo
activarRastreoGPS();

// Exportamos la aplicación para compatibilidad
module.exports = app;