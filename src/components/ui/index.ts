/**
 * CorpusImmo design system — single import surface.
 * Une seule bibliothèque de composants, une seule direction artistique.
 * Les tokens vivent dans `globals.css` ; aucun composant n'écrit de couleur.
 */

export { Button } from "./button";
export type { ButtonProps, ButtonSize, ButtonVariant } from "./button";

export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";
export type { CardProps } from "./card";

export { Badge, StatusBadge } from "./badge";
export type { BadgeProps, BadgeTone } from "./badge";

export { Field, Input, Textarea } from "./input";
export type { FieldProps, InputProps, TextareaProps } from "./input";

export { Select } from "./select";
export type { SelectProps } from "./select";

export { ChoiceCard, ChoiceGroup } from "./choice";
export type { ChoiceCardProps, ChoiceGroupProps } from "./choice";

export { Checkbox, Toggle } from "./toggle";
export type { CheckboxProps, ToggleProps } from "./toggle";

export { Modal } from "./modal";
export type { ModalProps } from "./modal";

export { Drawer } from "./drawer";
export type { DrawerProps } from "./drawer";

export { Tooltip } from "./tooltip";
export type { TooltipProps } from "./tooltip";

export { Tabs } from "./tabs";
export type { TabItem, TabsProps } from "./tabs";

export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "./table";
export type {
  TableCellProps,
  TableHeaderCellProps,
  TableProps,
  TableRowProps,
} from "./table";

export { Skeleton, SkeletonCard, SkeletonText } from "./skeleton";

export { EmptyState, ErrorState, LoadingState } from "./states";
export type { EmptyStateProps, ErrorStateProps, LoadingStateProps } from "./states";

export { Spinner } from "./spinner";
export type { SpinnerProps } from "./spinner";

export { ToastProvider, useToast } from "./toast";
export type { ToastInput, ToastTone } from "./toast";

export { Stat } from "./stat";
export type { StatProps } from "./stat";

export { Progress, Stepper } from "./progress";
export type { ProgressProps, StepperProps } from "./progress";

export { Accordion } from "./disclosure";
export type { AccordionItem, AccordionProps } from "./disclosure";

export { PageHeader } from "./section";
export type { PageHeaderProps } from "./section";
