import { ContractStatus, STATUS_LABELS, STATUS_COLORS } from "@/contexts/ContractContext";

interface Props {
  status: ContractStatus;
}

const ContractStatusBadge = ({ status }: Props) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
    {STATUS_LABELS[status]}
  </span>
);

export default ContractStatusBadge;
