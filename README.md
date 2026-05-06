# IPv4 Publica

Pagina minima para desplegar en Coolify y mostrar la IPv4 publica del visitante.

## Local

```bash
npm start
```

Abre `http://localhost:3000`.

## Coolify

1. Crea una nueva app desde este repositorio/carpeta.
2. Usa el `Dockerfile`.
3. Publica el puerto `3000`.
4. El endpoint de salud es `/health`.

La app primero lee `cf-connecting-ip`, `x-real-ip`, `x-forwarded-for` y la IP del socket. Si el proxy solo entrega una IP interna, el navegador usa `https://api.ipify.org?format=json` como fallback para mostrar la IPv4 publica real del visitante.
