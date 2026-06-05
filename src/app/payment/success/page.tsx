export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  // Verificamos el estado real del pago en Stripe. Una sesión puede llegar
  // aquí sin estar pagada (link caducado, URL revisitada, etc.), así que NO
  // mostramos "Pago recibido" salvo que Stripe confirme payment_status="paid".
  let paid = false;
  let expired = false;
  if (session_id) {
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      const session = await stripe.checkout.sessions.retrieve(session_id);
      paid = session.payment_status === "paid";
      expired = session.status === "expired";
    } catch {
      paid = false;
    }
  }

  if (paid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-4 max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mb-2 text-xl font-bold text-zinc-900 dark:text-white">Pago recibido</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Gracias por tu pago. En breve recibiras la factura por email y nos pondremos en marcha con tu proyecto.
          </p>
          <a
            href="https://prototipalo.com"
            className="mt-6 inline-block rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            Volver a Prototipalo
          </a>
        </div>
      </div>
    );
  }

  // No pagado — link caducado o pago no completado.
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-4 max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <svg className="h-8 w-8 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h1 className="mb-2 text-xl font-bold text-zinc-900 dark:text-white">
          {expired ? "El enlace de pago ha caducado" : "Pago no completado"}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {expired
            ? "Este enlace de pago ha caducado y no se ha realizado ningun cargo. Por favor, contacta con nosotros para que te enviemos un nuevo enlace."
            : "Todavia no hemos recibido el pago. Si crees que es un error, contacta con nosotros o vuelve a intentarlo con el enlace que te enviamos."}
        </p>
        <a
          href="mailto:info@prototipalo.com"
          className="mt-6 inline-block rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
        >
          Contactar con Prototipalo
        </a>
      </div>
    </div>
  );
}
