import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type Category = {
  id: string;
  title: string;
  slug: string;
  image: string;
};

export default function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase.from("categories").select("*");
      if (!error && data) {
        setCategories(data);
      }
      setLoading(false);
    };
    fetchCategories();
  }, []);

  return { categories, loading };
}
