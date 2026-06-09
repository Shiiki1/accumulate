import { MinimalHeader } from "@/components/MinimalHeader";

export default function ThreeDPage() {
  return (
    <>
      <MinimalHeader />
      <main className="mx-auto grid min-h-[calc(100vh-72px)] w-full max-w-7xl place-items-center px-4 py-16 sm:px-6 lg:px-8">
        <section className="max-w-xl text-center">
          <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">
            3D references
          </p>
          <h1 className="font-serif-accent mt-3 text-6xl leading-none sm:text-7xl">
            Spatial archive.
          </h1>
          <p className="mt-6 text-sm leading-7 text-[var(--muted)]">
            A quiet place for models, materials, forms, and spatial references.
          </p>
        </section>
      </main>
    </>
  );
}
