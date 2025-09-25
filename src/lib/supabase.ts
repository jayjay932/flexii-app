import { createClient } from "@supabase/supabase-js";
// ⚠ indispensable pour supabase-js en React Native
import "react-native-url-polyfill/auto";

const SUPABASE_URL = "https://qilklozxaubrokidfeyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbGtsb3p4YXVicm9raWRmZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzOTQ4NzIsImV4cCI6MjA3Mzk3MDg3Mn0.VrN3fl-9lzqWjF0jfmoa68XxMF_Y7MPk1TocHQA-tcw";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
