# Usa la imagen oficial de Deno
FROM denoland/deno:latest

# --- CAMBIO CLAVE ---
# Define una ubicación fija para la caché de Deno dentro del contenedor.
ENV DENO_DIR /deno-dir/

# Establece el directorio de trabajo
WORKDIR /app

# Copia tu archivo de dependencias primero para optimizar la caché de Docker
COPY deps.ts .

# Descarga e instala las dependencias en la ubicación que definimos.
RUN deno cache deps.ts

# Copia el resto de tu código
COPY . .

# Expone el puerto 8000
EXPOSE 8000

# El comando para iniciar tu aplicación (usará la caché de /deno-dir/)
CMD ["run", "-A", "scraper-service.ts"]
