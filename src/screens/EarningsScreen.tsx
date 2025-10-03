import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons, { IconName } from '@/src/ui/Icon';
import { supabase } from "@/src/lib/supabase";

/* =============== Types =============== */

type Granularity = "year" | "month" | "day";
type KindFilter = "all" | "logement" | "vehicule" | "experience";

type TxnRow = { status: string | null };

type BaseRes = {
  id: string;
  created_at: string;
  start_date: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | string | null;
  total_price: number | string | null;
  commission: number | string | null;
  currency: string | null;

  // conditions
  arrival_confirmation: boolean | null;
  espece_confirmation: boolean | null;
  price_espece: number | string | null;

  // type
  logement_id: string | null;
  vehicule_id: string | null;
  experience_id: string | null;

  transactions?: TxnRow[] | null;
};

/* =============== Helpers =============== */

const money = (n: number, cur = "XOF") =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: cur as any }).format(Number(n || 0));

const monthNamesShort = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sept", "Oct", "Nov", "Déc"];
const daysInMonth = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();
const startOfMonthISO = (y: number, m0: number) => new Date(Date.UTC(y, m0, 1)).toISOString().slice(0, 10);
const endOfMonthISO = (y: number, m0: number) => new Date(Date.UTC(y, m0, daysInMonth(y, m0))).toISOString().slice(0, 10);
const startOfDayISO = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
const endOfDayISO   = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)).toISOString().slice(0, 10);

const netOf = (r: BaseRes) => Number(r.total_price || 0) - Number(r.commission || 0);

/** ✅ Règle d’éligibilité finale */
const eligible = (r: BaseRes) => {
  const confirmed = r.status === "confirmed" || r.status === "completed";
  const arrivalOk = !!r.arrival_confirmation;
  const paidTxn = (r.transactions || []).some((t) => t.status === "paid");
  const cashDue = Number(r.price_espece || 0) > 0;
  const cashOk = !cashDue || !!r.espece_confirmation;
  return confirmed && arrivalOk && paidTxn && cashOk;
};

/* =============== Petit bar chart (sans lib) =============== */

function BarChart({
  labels, values, highlightIndex, onSelectIndex,
}: { labels: string[]; values: number[]; highlightIndex?: number; onSelectIndex?: (i: number) => void }) {
  const max = Math.max(1, ...values);
  return (
    <View style={styles.chartWrap}>
      {[0.25, 0.5, 0.75, 1].map((p) => (
        <View key={p} style={[styles.chartLine, { bottom: `${p * 100}%` }]} />
      ))}
      <View style={styles.barsRow}>
        {values.map((v, i) => {
          const h = (v / max) * 100;
          const active = i === highlightIndex;
          return (
            <TouchableOpacity key={i} style={styles.barSlot} activeOpacity={0.85} onPress={() => onSelectIndex?.(i)}>
              <View style={[styles.bar, active && styles.barActive, { height: `${h}%` }]} />
              <Text style={[styles.barLabel, active && styles.barLabelActive]} numberOfLines={1}>{labels[i]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/* =============== Écran =============== */

export default function EarningsScreen({ navigation }: any) {
  const [gran, setGran] = useState<Granularity>("month");
  const [kind, setKind] = useState<KindFilter>("all");

  const today = new Date();
  const [cursorYear, setCursorYear] = useState(today.getFullYear());
  const [cursorMonth, setCursorMonth] = useState(today.getMonth()); // 0..11
  const [cursorDay, setCursorDay] = useState(today);

  const [rows, setRows] = useState<BaseRes[]>([]);
  const [loading, setLoading] = useState(true);
  const [selIndex, setSelIndex] = useState<number | undefined>(undefined);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounced = useCallback((fn: () => void, d = 200) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fn, d);
  }, []);

  // période courante
  const { dateMinISO, dateMaxISO, periodTitle } = useMemo(() => {
    if (gran === "year") {
      return { dateMinISO: `${cursorYear}-01-01`, dateMaxISO: `${cursorYear}-12-31`, periodTitle: `${cursorYear}` };
    }
    if (gran === "month") {
      return {
        dateMinISO: startOfMonthISO(cursorYear, cursorMonth),
        dateMaxISO: endOfMonthISO(cursorYear, cursorMonth),
        periodTitle: `${monthNamesShort[cursorMonth]} ${cursorYear}`,
      };
    }
    return {
      dateMinISO: startOfDayISO(cursorDay),
      dateMaxISO: endOfDayISO(cursorDay),
      periodTitle: cursorDay.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }),
    };
  }, [gran, cursorYear, cursorMonth, cursorDay]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: auth } = await supabase.auth.getSession();
      const uid = auth.session?.user?.id;
      if (!uid) { navigation.replace("AuthSheet"); return; }

      // SELECT commun ; on tire aussi price_espece & arrival_confirmation
   // --- avant (résumé) ---
// .select(`${baseSel}, listings_logements:logement_id ( owner_id )`)
// .not("logement_id", "is", null)
// .eq("listings_logements.owner_id", uid)
// (idem pour véhicules / expériences)


// --- après : jointure inner + filtre propriétaire ---
const baseSel = `
  id, created_at, start_date, status, total_price, commission, currency,
  arrival_confirmation, espece_confirmation, price_espece,
  logement_id, vehicule_id, experience_id,
  transactions!inner ( status )
`;

const where = (q: any) =>
  q
    .gte("start_date", dateMinISO)
    .lte("start_date", dateMaxISO)
    .in("status", ["confirmed", "completed"])
    .eq("arrival_confirmation", true)
    .eq("transactions.status", "paid")
    .or("price_espece.eq.0,espece_confirmation.is.true"); // espèces ok

const wantsLog = kind === "all" || kind === "logement";
const wantsVeh = kind === "all" || kind === "vehicule";
const wantsExp = kind === "all" || kind === "experience";

const qs: Promise<any>[] = [];

if (wantsLog) {
  qs.push(
    where(
      supabase
        .from("reservations")
        // 👇 jointure INNER sur la relation logement_id
        .select(`${baseSel}, logement:logement_id!inner ( owner_id )`)
        // 👇 garde uniquement les réservations dont le logement appartient à l'utilisateur connecté
        .eq("logement.owner_id", uid)
    )
  );
}

if (wantsVeh) {
  qs.push(
    where(
      supabase
        .from("reservations")
        .select(`${baseSel}, vehicule:vehicule_id!inner ( owner_id )`)
        .eq("vehicule.owner_id", uid)
    )
  );
}

if (wantsExp) {
  qs.push(
    where(
      supabase
        .from("reservations")
        .select(`${baseSel}, experience:experience_id!inner ( owner_id )`)
        .eq("experience.owner_id", uid)
    )
  );
}

const res = await Promise.all(qs);
for (const r of res) if (r.error) throw r.error;
setRows(res.flatMap((r) => r.data || []));
setSelIndex(undefined);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [dateMinISO, dateMaxISO, kind, navigation]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // realtime (réservations & transactions)
  useEffect(() => {
    const ch = supabase
      .channel("earnings-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => debounced(fetchData))
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => debounced(fetchData))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchData, debounced]);

  // agrégation
  const currency = rows[0]?.currency || "XOF";
  const { labels, values, totals, counts } = useMemo(() => {
    const rs = rows.filter(eligible);

    const sumCommission = rs.reduce((a, r) => a + Number(r.commission || 0), 0);

    if (gran === "year") {
      const vals = Array(12).fill(0) as number[];
      const cnts = Array(12).fill(0) as number[];
      rs.forEach((r) => { const d = new Date(r.start_date); vals[d.getUTCMonth()] += netOf(r); cnts[d.getUTCMonth()]++; });
      return { labels: monthNamesShort, values: vals, totals: { net: vals.reduce((a,b)=>a+b,0), commission: sumCommission }, counts: cnts };
    }
    if (gran === "month") {
      const days = daysInMonth(cursorYear, cursorMonth);
      const vals = Array(days).fill(0) as number[];
      const cnts = Array(days).fill(0) as number[];
      rs.forEach((r) => {
        const d = new Date(r.start_date);
        if (d.getUTCFullYear() !== cursorYear || d.getUTCMonth() !== cursorMonth) return;
        const i = d.getUTCDate() - 1; vals[i] += netOf(r); cnts[i]++;
      });
      return { labels: Array.from({length: days}, (_,i)=>String(i+1)), values: vals, totals: { net: vals.reduce((a,b)=>a+b,0), commission: sumCommission }, counts: cnts };
    }
    // day -> 24h
    const vals = Array(24).fill(0) as number[];
    const cnts = Array(24).fill(0) as number[];
    const key = cursorDay.toISOString().slice(0,10);
    rs.forEach((r) => {
      const d = new Date(r.created_at);
      if (d.toISOString().slice(0,10) !== key) return;
      vals[d.getUTCHours()] += netOf(r); cnts[d.getUTCHours()]++;
    });
    return { labels: Array.from({length:24},(_,i)=>String(i)), values: vals, totals: { net: vals.reduce((a,b)=>a+b,0), commission: sumCommission }, counts: cnts };
  }, [rows, gran, cursorYear, cursorMonth, cursorDay]);

  const totalReservations = useMemo(() => rows.filter(eligible).length, [rows]);

  const goPrev = () => {
    if (gran === "year") setCursorYear((y) => y - 1);
    else if (gran === "month") { setCursorMonth((m) => (m === 0 ? 11 : m - 1)); if (cursorMonth === 0) setCursorYear((y) => y - 1); }
    else { const d = new Date(cursorDay); d.setDate(d.getDate() - 1); setCursorDay(d); }
  };
  const goNext = () => {
    if (gran === "year") setCursorYear((y) => y + 1);
    else if (gran === "month") { setCursorMonth((m) => (m === 11 ? 0 : m + 1)); if (cursorMonth === 11) setCursorYear((y) => y + 1); }
    else { const d = new Date(cursorDay); d.setDate(d.getDate() + 1); setCursorDay(d); }
  };

  if (loading) {
    return (<View style={styles.center}><ActivityIndicator size="large" color="#000" /></View>);
  }

  const selectedValue = typeof selIndex === "number" ? values[selIndex] : undefined;
  const selectedCount = typeof selIndex === "number" ? counts[selIndex] : undefined;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.safe}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.roundBtn}><Ionicons name="chevron-back" size={22} color="#111" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Revenus</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
          {/* Filtres */}
          <View style={styles.filtersRow}>
            <Segmented
              values={[{key:"year",label:"Année"},{key:"month",label:"Mois"},{key:"day",label:"Jour"}]}
              value={gran} onChange={(v)=>setGran(v as Granularity)}
            />
            <Segmented
              values={[{key:"all",label:"Tous"},{key:"logement",label:"Logements"},{key:"vehicule",label:"Véhicules"},{key:"experience",label:"Expériences"}]}
              value={kind} onChange={(v)=>setKind(v as KindFilter)}
            />
          </View>

          {/* Période + nav */}
          <View style={styles.periodRow}>
            <TouchableOpacity onPress={goPrev} style={styles.pillNav}><Ionicons name="chevron-back" size={18} color="#111" /></TouchableOpacity>
            <Text style={styles.periodTitle}>{periodTitle}</Text>
            <TouchableOpacity onPress={goNext} style={styles.pillNav}><Ionicons name="chevron-forward" size={18} color="#111" /></TouchableOpacity>
          </View>

          {/* Résumé */}
          <View style={styles.paidRow}>
            <View style={styles.dotPaid} />
            <Text style={styles.paidTxt}>
              Net comptabilisé {money(totals.net, currency)}{" "}
              {typeof selIndex === "number" && (
                <Text style={styles.paidSub}>
                  — sélection : {money(selectedValue || 0, currency)} · {selectedCount || 0} rés.
                </Text>
              )}
            </Text>
          </View>

          {/* Graph */}
          <BarChart labels={labels} values={values} highlightIndex={selIndex} onSelectIndex={setSelIndex} />

          {/* KPIs */}
          <View style={styles.metricsRow}>
            <MetricCard label="Réservations" value={String(totalReservations)} icon="calendar-outline" />
            <MetricCard label="Commission" value={money(totals.commission, currency)} icon="pie-chart-outline" />
            <MetricCard label="Net payé" value={money(totals.net, currency)} icon="cash-outline" dark />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* =============== UI Bits =============== */

function Segmented({ values, value, onChange }:{
  values:{key:string;label:string}[]; value:string; onChange:(k:string)=>void
}) {
  return (
    <View style={styles.segWrap}>
      {values.map((v) => {
        const active = v.key === value;
        return (
          <TouchableOpacity key={v.key} onPress={() => onChange(v.key)} style={[styles.segBtn, active && styles.segBtnActive]} activeOpacity={0.9}>
            <Text style={[styles.segTxt, active && styles.segTxtActive]}>{v.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MetricCard({ label, value, icon, dark }:{ label:string; value:string; icon:string; dark?:boolean }) {
  return (
    <View style={[styles.metricCard, dark && styles.metricDark]}>
      <Ionicons name={icon as any} size={18} color={dark ? "#fff" : "#111"} />
      <Text style={[styles.metricLabel, dark && { color: "#fff" }]}>{label}</Text>
      <Text style={[styles.metricValue, dark && { color: "#fff" }]}>{value}</Text>
    </View>
  );
}

/* =============== Styles =============== */

const R = 18;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#c4c0c0ff" },
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  headerRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 26, fontWeight: "900", color: "#111" },
  roundBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.06)", alignItems: "center", justifyContent: "center" },

  filtersRow: { gap: 8, paddingHorizontal: 16, marginTop: 8 },
  segWrap: { backgroundColor: "#f3f3f3", borderRadius: 999, padding: 4, flexDirection: "row", gap: 6 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: "center" },
  segBtnActive: { backgroundColor: "#fff" },
  segTxt: { fontWeight: "800", color: "#666" },
  segTxtActive: { color: "#111" },

  periodRow: { marginTop: 10, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center" },
  pillNav: { backgroundColor: "#f2f2f2", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  periodTitle: { fontSize: 22, fontWeight: "900", color: "#111" },

  paidRow: { marginTop: 10, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  dotPaid: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#D63C7B" },
  paidTxt: { fontWeight: "900", color: "#111" },
  paidSub: { color: "#666", fontWeight: "700" },

  chartWrap: { marginTop: 10, marginHorizontal: 12, height: 240, borderRadius: R, backgroundColor: "#fff", borderWidth: 1, borderColor: "rgba(0,0,0,0.06)", overflow: "hidden" },
  chartLine: { position: "absolute", left: 0, right: 0, borderTopWidth: 1, borderColor: "rgba(0,0,0,0.06)" },
  barsRow: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, paddingHorizontal: 10, paddingBottom: 24, flexDirection: "row" },
  barSlot: { flex: 1, alignItems: "center", justifyContent: "flex-end", paddingHorizontal: 3 },
  bar: { width: "100%", maxWidth: 22, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: "#EA1261", opacity: 0.9 },
  barActive: { backgroundColor: "#111", opacity: 1 },
  barLabel: { marginTop: 6, fontSize: 11, color: "#777", fontWeight: "700" },
  barLabelActive: { color: "#111", fontWeight: "900" },

  metricsRow: { marginTop: 14, paddingHorizontal: 16, flexDirection: "row", gap: 10 },
  metricCard: { flex: 1, backgroundColor: "rgba(0,0,0,0.04)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 12, alignItems: "flex-start", gap: 6 },
  metricDark: { backgroundColor: "#111" },
  metricLabel: { color: "#555", fontWeight: "800" },
  metricValue: { color: "#111", fontWeight: "900", fontSize: 16 },
});
