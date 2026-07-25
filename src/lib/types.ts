export type Item = {
  id: string;
  url: string | null;
  source_domain: string | null;
  image_path: string;
  title: string | null;
  description: string | null;
  category: string | null;
  style: string[];
  color: string | null;
  tech: string[];
  tags: string[];
  notes: string | null;
  created_at: string;
};
