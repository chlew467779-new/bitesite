/* bitesite/components/home/home-filters.tsx */

"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Clock, MapPin } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

type Panel = "area" | "cuisine" | "more" | null;

export interface HomeFiltersProps {
  nearbyActive: boolean;
  nearbyLoading: boolean;
  onNearbyChange: (active: boolean) => void;
  openNow: boolean;
  onOpenNowChange: (value: boolean) => void;
  availableStates: string[];
  currentState: string | null;
  onStateChange: (state: string | null) => void;
  availableAreas: string[];
  activeArea: string | null;
  onAreaChange: (area: string | null) => void;
  availableCuisines: string[];
  activeCuisines: string[];
  onCuisineChange: (cuisines: string[]) => void;
  availableMore: string[];
  activeMore: string[];
  onMoreChange: (more: string[]) => void;
}

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

/**
 * One scrolling row of filter chips (R3 design). Nearby and Open now switch on tap; Area,
 * Cuisine and More open a bottom sheet. Every filter combines with the others.
 */
export function HomeFilters(props: HomeFiltersProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const areaChosen = Boolean(props.activeArea && props.activeArea !== "All Areas");
  const areaLabel = areaChosen ? props.activeArea : props.currentState ?? "Area";

  return (
    <>
      <nav aria-label="Filters" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 pt-2 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
        <Chip selected={props.nearbyActive} disabled={props.nearbyLoading} onClick={() => props.onNearbyChange(!props.nearbyActive)}>
          <MapPin size={16} aria-hidden />
          {props.nearbyLoading ? "Locating…" : "Nearby"}
        </Chip>
        <Chip selected={props.openNow} onClick={() => props.onOpenNowChange(!props.openNow)}>
          <Clock size={16} aria-hidden />
          Open now
        </Chip>
        {(props.availableAreas.length > 1 || props.availableStates.length > 1) && (
          <Chip selected={areaChosen || Boolean(props.currentState)} onClick={() => setPanel("area")} aria-haspopup="dialog">
            {areaLabel}
            <ChevronDown size={16} aria-hidden />
          </Chip>
        )}
        {props.availableCuisines.length > 0 && (
          <Chip selected={props.activeCuisines.length > 0} onClick={() => setPanel("cuisine")} aria-haspopup="dialog">
            {props.activeCuisines.length === 1 ? props.activeCuisines[0] : props.activeCuisines.length > 1 ? `Cuisine · ${props.activeCuisines.length}` : "Cuisine"}
            <ChevronDown size={16} aria-hidden />
          </Chip>
        )}
        {props.availableMore.length > 0 && (
          <Chip selected={props.activeMore.length > 0} onClick={() => setPanel("more")} aria-haspopup="dialog">
            {props.activeMore.length > 0 ? `More · ${props.activeMore.length}` : "More"}
            <ChevronDown size={16} aria-hidden />
          </Chip>
        )}
      </nav>

      <Sheet open={panel === "area"} onClose={() => setPanel(null)} title="Area">
        {props.availableStates.length > 1 && (
          <ChoiceGroup label="State">
            {[null, ...props.availableStates].map((state) => (
              <Chip key={state ?? "all"} selected={props.currentState === state} onClick={() => props.onStateChange(state)}>
                {state ?? "All states"}
              </Chip>
            ))}
          </ChoiceGroup>
        )}
        <ChoiceGroup label="Area">
          {props.availableAreas.map((area) => {
            const selected = area === "All Areas" ? !areaChosen : props.activeArea === area;
            return (
              <Chip key={area} selected={selected} onClick={() => props.onAreaChange(area === "All Areas" ? null : area)}>
                {area}
              </Chip>
            );
          })}
        </ChoiceGroup>
        <SheetDone onDone={() => setPanel(null)} />
      </Sheet>

      <Sheet open={panel === "cuisine"} onClose={() => setPanel(null)} title="Cuisine">
        <ChoiceGroup label="Choose one or more">
          {props.availableCuisines.map((cuisine) => (
            <Chip key={cuisine} selected={props.activeCuisines.includes(cuisine)} onClick={() => props.onCuisineChange(toggle(props.activeCuisines, cuisine))}>
              {cuisine}
            </Chip>
          ))}
        </ChoiceGroup>
        <SheetDone onDone={() => setPanel(null)} onClear={props.activeCuisines.length > 0 ? () => props.onCuisineChange([]) : undefined} />
      </Sheet>

      <Sheet open={panel === "more"} onClose={() => setPanel(null)} title="More filters">
        <ChoiceGroup label="Choose one or more">
          {props.availableMore.map((item) => (
            <Chip key={item} selected={props.activeMore.includes(item)} onClick={() => props.onMoreChange(toggle(props.activeMore, item))}>
              {item}
            </Chip>
          ))}
        </ChoiceGroup>
        <SheetDone onDone={() => setPanel(null)} onClear={props.activeMore.length > 0 ? () => props.onMoreChange([]) : undefined} />
      </Sheet>
    </>
  );
}

function ChoiceGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="mb-5">
      <legend className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-muted">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function SheetDone({ onDone, onClear }: { onDone: () => void; onClear?: () => void }) {
  return (
    <div className="flex gap-2 pt-1">
      {onClear && <Button variant="secondary" onClick={onClear}>Clear</Button>}
      <Button block onClick={onDone}>Show restaurants</Button>
    </div>
  );
}
