export default function AppLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="mb-14 max-w-xl">
        <div className="image-skeleton h-4 w-32 rounded-full" />
        <div className="image-skeleton mt-5 h-16 w-72 rounded-md" />
      </div>
      <div className="masonry columns-1 md:columns-2 xl:columns-3">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="masonry-item">
            <div
              className={`image-skeleton rounded-[var(--radius-card)] ${
                index % 3 === 0
                  ? "aspect-[4/5]"
                  : index % 3 === 1
                    ? "aspect-[3/4]"
                    : "aspect-square"
              }`}
            />
          </div>
        ))}
      </div>
    </main>
  );
}
