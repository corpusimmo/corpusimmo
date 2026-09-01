import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as UI from "./index";
import {
  BarChart,
  DistributionChart,
  LineChart,
  RangeBar,
  Sparkline,
} from "../charts";

describe("smoke", () => {
  it("renders every primitive", () => {
    render(
      <UI.ToastProvider>
        <UI.PageHeader title="Observatoire" description="d" actions={<UI.Button>a</UI.Button>} />
        <UI.Card interactive>
          <UI.CardHeader>
            <UI.CardTitle>t</UI.CardTitle>
            <UI.CardDescription>d</UI.CardDescription>
          </UI.CardHeader>
          <UI.CardContent>c</UI.CardContent>
          <UI.CardFooter>f</UI.CardFooter>
        </UI.Card>
        <UI.Badge tone="accent">b</UI.Badge>
        <UI.StatusBadge status="preview" />
        <UI.Field label="Surface" htmlFor="s" hint="en m²" error="obligatoire" required>
          <UI.Input id="s" invalid aria-describedby="s-error" />
        </UI.Field>
        <UI.Textarea />
        <UI.Select>
          <option>a</option>
        </UI.Select>
        <UI.Stat label="Ventes" value="147" hint="800 m" trend={{ value: "+4 %", direction: "up" }} />
        <UI.Progress value={62} label="Confiance" />
        <UI.Stepper steps={["Bien", "Surface", "Contact"]} current={1} />
        <UI.Skeleton />
        <UI.SkeletonText lines={2} />
        <UI.SkeletonCard />
        <UI.EmptyState title="Rien" description="d" action={<UI.Button size="sm">a</UI.Button>} />
        <UI.ErrorState />
        <UI.LoadingState />
        <UI.Table caption="Comparables">
          <UI.TableHead>
            <UI.TableRow>
              <UI.TableHeaderCell sortable sorted="asc">
                Prix
              </UI.TableHeaderCell>
              <UI.TableHeaderCell align="right">Surface</UI.TableHeaderCell>
            </UI.TableRow>
          </UI.TableHead>
          <UI.TableBody>
            <UI.TableRow selected>
              <UI.TableCell numeric>348 000 €</UI.TableCell>
              <UI.TableCell align="right">72 m²</UI.TableCell>
            </UI.TableRow>
          </UI.TableBody>
        </UI.Table>
        <UI.Accordion items={[{ id: "a", title: "Question", content: "Réponse" }]} defaultOpen="a" />
      </UI.ToastProvider>,
    );

    expect(screen.getByRole("heading", { name: "Observatoire" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Comparables" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Prix/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "62");
    expect(screen.getByText("Bientôt disponible")).toBeInTheDocument();
  });

  it("drives tabs with the keyboard", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [value, setValue] = useState("a");
      return (
        <UI.Tabs
          label="Vues"
          value={value}
          onChange={setValue}
          items={[
            { id: "a", label: "Carte" },
            { id: "b", label: "Liste", badge: "12" },
            { id: "c", label: "Stats" },
          ]}
        />
      );
    }

    render(<Harness />);
    const tabs = screen.getAllByRole("tab");
    const first = tabs[0];
    const second = tabs[1];
    const third = tabs[2];
    if (!first || !second || !third) throw new Error("missing tabs");

    first.focus();
    await user.keyboard("{ArrowRight}");
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{End}");
    expect(third).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(first).toHaveFocus();

    await user.keyboard("{Home}");
    expect(first).toHaveAttribute("aria-selected", "true");
  });

  it("toggles switches and checkboxes through their labels", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [on, setOn] = useState(false);
      return (
        <>
          <UI.Toggle checked={on} onChange={setOn} label="Recevoir le rapport" description="PDF" />
          <UI.Checkbox label="J'accepte" error="Consentement requis" />
        </>
      );
    }

    render(<Harness />);
    const toggle = screen.getByRole("switch", { name: /Recevoir le rapport/ });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");

    const checkbox = screen.getByRole("checkbox", { name: "J'accepte" });
    expect(checkbox).toHaveAccessibleDescription("Consentement requis");
    await user.click(screen.getByText("J'accepte"));
    expect(checkbox).toBeChecked();
  });

  it("stacks, announces and dismisses toasts", async () => {
    const user = userEvent.setup();

    function Trigger() {
      const { toast } = UI.useToast();
      return (
        <button type="button" onClick={() => toast({ title: "Enregistré", tone: "success" })}>
          go
        </button>
      );
    }

    render(
      <UI.ToastProvider>
        <Trigger />
      </UI.ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: "go" }));
    expect(screen.getByText("Enregistré")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Notifications" })).toHaveAttribute(
      "aria-live",
      "polite",
    );

    await user.click(screen.getByRole("button", { name: "Fermer la notification" }));
    expect(screen.queryByText("Enregistré")).not.toBeInTheDocument();
  });

  it("opens a drawer, traps focus and closes on Escape", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            ouvrir
          </button>
          <UI.Drawer open={open} onClose={() => setOpen(false)} title="Détail" side="right">
            <input aria-label="note" />
          </UI.Drawer>
        </>
      );
    }

    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "ouvrir" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Détail");
    expect(screen.getByRole("button", { name: "Fermer" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ouvrir" })).toHaveFocus();
  });

  it("renders choice cards", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [selected, setSelected] = useState<string | null>(null);
      return (
        <UI.ChoiceGroup label="Type de bien" columns={3}>
          <UI.ChoiceCard
            title="Appartement"
            description="En immeuble"
            selected={selected === "flat"}
            onSelect={() => setSelected("flat")}
          />
        </UI.ChoiceGroup>
      );
    }

    render(<Harness />);
    const card = screen.getByRole("button", { name: /Appartement/ });
    expect(card).toHaveAttribute("aria-pressed", "false");
    await user.click(card);
    expect(card).toHaveAttribute("aria-pressed", "true");
  });

  it("renders charts, including their empty states", () => {
    const { container } = render(
      <div>
        <BarChart data={[{ label: "2023", value: 12 }, { label: "2024", value: 30 }]} />
        <BarChart data={[]} />
        <LineChart
          series={[
            { label: "Prix", points: [{ x: "2023", y: 4100 }, { x: "2024", y: 4280 }] },
            { label: "Ref", points: [{ x: "2023", y: 3900 }], tone: "muted" },
          ]}
        />
        <LineChart series={[]} />
        <Sparkline values={[1, 4, 2, 8]} />
        <Sparkline values={[]} />
        <RangeBar low={325000} central={348000} high={371000} />
        <RangeBar low={Number.NaN} central={0} high={1} />
        <DistributionChart values={[3800, 4100, 4280, 4400, 5000]} highlight={4280} />
        <DistributionChart values={[]} />
      </div>,
    );

    expect(screen.getAllByText("Aucune donnée à afficher")).toHaveLength(3);
    expect(screen.getByText("Fourchette indisponible")).toBeInTheDocument();
    expect(screen.getByText("348 000 €")).toBeInTheDocument();
    // No hardcoded palette colours anywhere in the rendered markup.
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{6}/);
    expect(container.innerHTML).not.toMatch(/(bg|text|fill|stroke)-(blue|red|green|gray|slate)-\d/);
  });
});
