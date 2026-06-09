import { ItemDetail } from "@/components/ItemDetail";

type ItemPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ItemPage({ params }: ItemPageProps) {
  const { id } = await params;

  return <ItemDetail itemId={id} />;
}
