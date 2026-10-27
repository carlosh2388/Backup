// Se ejecuta una vez al arrancar el servidor de Next.js: inicia la consulta periódica de las sedes.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { iniciarColector } = await import("./lib/colector");
    iniciarColector();
  }
}
