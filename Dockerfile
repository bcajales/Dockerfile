# Usa la imagen oficial de Deno
FROM denoland/deno:latest

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia tu archivo de dependencias
COPY deps.ts .

# -- ESTE ES EL PASO CLAVE QUE SÍ FUNCIONA --
# Descarga e instala todas las dependencias de forma robusta
RUN deno cache deps.ts

# Copia el resto de tu código
COPY . .

# Expone el puerto 8000 (Fly.io lo mapeará automáticamente)
EXPOSE 8000

# El comando para iniciar tu aplicación
CMD ["run", "-A", "scraper-service.ts"]
