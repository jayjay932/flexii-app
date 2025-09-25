import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function useBackground(screen: string) {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBackground = async () => {
      const { data, error } = await supabase
        .from("backgrounds")
        .select("image")
        .eq("screen", screen)
        .single();

      if (!error && data) {
        setImage(data.image);
      }
      setLoading(false);
    };
    fetchBackground();
  }, [screen]);

  return { image, loading };
}
