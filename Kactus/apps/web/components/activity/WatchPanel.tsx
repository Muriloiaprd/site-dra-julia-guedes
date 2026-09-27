"use client";

import type { ReactNode } from "react";

import { Panel } from "@/components/ui/primitives";
import type { ActivityDetail, ZoneBucket } from "@/lib/api";
import { formatDuration, formatPaceShort, isStepSport } from "@/lib/utils";

/** Faixas do efeito de treino do Garmin (0 a 5), em linguagem simples. */
function effectLabel(v: number): { label: string; color: string } {
  if (v < 1) return { label: "Nenhum benefício", color: "#888" };
  if (v < 2) return { label: "Benefício pequeno", color: "#00BFFF" };
  if (v < 3) return { label: "Mantém a forma", color: "#00FF66" };
  if (v < 4) return { label: "Melhora a forma", color: "#C6FF00" };
  if (v < 5) return { label: "Melhora muito", color: "#FFC145" };
  return { label: "Excessivo", color: "#F85149" };
}

/** Sensacao do relogio (0-100, de 25 em 25), como o Garmin mostra. */
export const WATCH_FEEL_LABEL: Record<number, string> = {
  0: "Muito fraco",
  25: "Fraco",
  50: "Normal",
  75: "Forte",
  100: "Muito forte",
};

export function watchFeelLabel(v: number | null): string | null {
  if (v == null) return null;
  const k = [0, 25, 50, 75, 100].reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  return WATCH_FEEL_LABEL[k];
}

function Block({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <div className="od-tile p-4">
      <div className="od-metric-label mb-3">{title}</div>
      <dl className="space-y-2.5">{children}</dl>
      {note && <p className="mt-3 text-[0.68rem] text-brand-textTertiary">{note}</p>}
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-[0.78rem] text-brand-muted">{label}</dt>
        <dd className="od-num text-sm text-white">{value}</dd>
      </div>
      {hint && <p className="mt-0.5 text-[0.68rem] leading-snug text-brand-textTertiary">{hint}</p>}
    </div>
  );
}

/** Minutos de intensidade estimados pelas zonas: moderado = Z2-Z3, alto = Z4-Z5 (conta em dobro). */
function intensityMinutes(zones: ZoneBucket[]) {
  const min = (zs: number[]) => Math.round(zones.filter((z) => zs.includes(z.zone)).reduce((s, z) => s + z.seconds, 0) / 60);
  const moderate = min([2, 3]);
  const vigorous = min([4, 5]);
  return { moderate, vigorous, total: moderate + vigorous * 2 };
}

/** Os dados que o relogio Garmin grava alem do basico. Some quando a atividade nao tem nenhum. */
export function WatchPanel({ activity: a, zones }: { activity: ActivityDetail; zones: ZoneBucket[] }) {
  const run = isStepSport(a.sport) && a.sport !== "walk";
  const hasEffect = a.training_effect_aerobic != null;
  const hasDynamics = run && (a.avg_step_length_m != null || a.avg_stance_time_ms != null);
  const hasTemp = a.avg_temperature_c != null;
  const activeCal = a.calories != null && a.resting_calories != null ? a.calories - a.resting_calories : null;
  const hasEnergy = a.sweat_loss_ml != null || a.resting_calories != null;
  const im = zones.some((z) => z.seconds > 0) ? intensityMinutes(zones) : null;
  const moving = a.moving_time_s ?? a.duration_s;
  const hasRunWalk = run && a.walk_time_s != null;

  if (!hasEffect && !hasDynamics && !hasTemp && !hasEnergy && !im) return null;

  const aer = hasEffect ? effectLabel(a.training_effect_aerobic!) : null;
  const ana = a.training_effect_anaerobic != null ? effectLabel(a.training_effect_anaerobic) : null;

  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="od-label">Mais do relógio</h2>
        <span className="text-[0.7rem] text-brand-textTertiary">Direto do arquivo do Garmin; “estimado” = calculado pelo Kactus</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {hasEffect && (
          <Block title="Efeito de treino" note="De 0 a 5: quanto o treino puxou seu condicionamento.">
            {a.primary_benefit_label && <Row label="Principal benefício" value={a.primary_benefit_label} />}
            <Row label="Aeróbico" value={<span style={{ color: aer!.color }}>{a.training_effect_aerobic!.toFixed(1)} · {aer!.label}</span>} />
            {ana && <Row label="Anaeróbico" value={<span style={{ color: ana.color }}>{a.training_effect_anaerobic!.toFixed(1)} · {ana.label}</span>} />}
          </Block>
        )}

        {hasDynamics && (
          <Block title="Dinâmica de corrida">
            {a.avg_cadence != null && <Row label="Cadência" value={`${Math.round(a.avg_cadence)} ppm`} hint="Compare com a sua de sempre no mesmo ritmo; não existe número mágico." />}
            {a.avg_step_length_m != null && <Row label="Comprimento da passada" value={`${a.avg_step_length_m.toFixed(2)} m`} />}
            {a.avg_vertical_oscillation_mm != null && <Row label="Oscilação vertical" value={`${(a.avg_vertical_oscillation_mm / 10).toFixed(1)} cm`} hint="O quanto você sobe e desce a cada passo. Menos gasta menos energia." />}
            {a.avg_vertical_ratio_pct != null && <Row label="Proporção vertical" value={`${a.avg_vertical_ratio_pct.toFixed(1)} %`} hint="Oscilação ÷ passada. Abaixo de ~7,5% é bom." />}
            {a.avg_stance_time_ms != null && <Row label="Contato com o solo" value={`${Math.round(a.avg_stance_time_ms)} ms`} hint="Tempo do pé no chão. Abaixo de ~240 ms é bom." />}
          </Block>
        )}

        {(im || hasRunWalk) && (
          <Block title="Intensidade" note="Estimado pelas suas zonas de FC e pela cadência.">
            {im && <Row label="Minutos de intensidade" value={im.total} hint={`${im.moderate} moderados + ${im.vigorous} altos (contam em dobro)`} />}
            {hasRunWalk && (
              <>
                <Row label="Correndo" value={formatDuration(Math.max(0, moving - a.walk_time_s!))} />
                <Row label="Andando" value={formatDuration(a.walk_time_s!)} />
              </>
            )}
          </Block>
        )}

        {hasTemp && (
          <Block title="Temperatura" note="Medida no relógio: o calor do pulso puxa um pouco para cima.">
            <Row label="Média" value={`${a.avg_temperature_c!.toFixed(1)} °C`} />
            {a.min_temperature_c != null && <Row label="Mínima" value={`${a.min_temperature_c.toFixed(0)} °C`} />}
            {a.max_temperature_c != null && <Row label="Máxima" value={`${a.max_temperature_c.toFixed(0)} °C`} />}
          </Block>
        )}

        {hasEnergy && (
          <Block title="Calorias e hidratação">
            {activeCal != null && <Row label="Calorias ativas" value={`${activeCal} kcal`} />}
            {a.resting_calories != null && <Row label="Calorias em repouso" value={`${a.resting_calories} kcal`} />}
            {a.sweat_loss_ml != null && <Row label="Perda de suor (estimada)" value={`${a.sweat_loss_ml} ml`} hint="Reponha aos poucos nas próximas horas." />}
          </Block>
        )}

        {(a.hr_recovery != null || a.max_speed_kmh != null || a.normalized_power_w != null || a.elevation_max_m != null) && (
          <Block title="Outros">
            {a.max_speed_kmh != null && (run
              ? <Row label="Melhor ritmo" value={`${formatPaceShort(3600 / a.max_speed_kmh)} /km`} />
              : <Row label="Velocidade máxima" value={`${a.max_speed_kmh.toFixed(1)} km/h`} />)}
            {a.hr_recovery != null && <Row label="FC de recuperação" value={`${a.hr_recovery} bpm`} hint="Quanto a FC caiu logo depois de parar. Quanto mais, melhor." />}
            {a.normalized_power_w != null && <Row label="Potência normalizada" value={`${a.normalized_power_w} W`} />}
            {a.elevation_min_m != null && a.elevation_max_m != null && <Row label="Elevação mín / máx" value={`${Math.round(a.elevation_min_m)} / ${Math.round(a.elevation_max_m)} m`} />}
          </Block>
        )}
      </div>
    </Panel>
  );
}
