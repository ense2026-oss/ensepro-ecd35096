import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface LoginAsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  loading?: boolean;
  onConfirm: () => void;
}

const LoginAsDialog = ({ open, onOpenChange, employeeName, loading, onConfirm }: LoginAsDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>เข้าสู่ระบบในฐานะพนักงาน</AlertDialogTitle>
        <AlertDialogDescription>
          คุณกำลังจะเข้าสู่ระบบในฐานะ <span className="font-semibold text-foreground">{employeeName}</span> โดยจะได้รับสิทธิ์การใช้งานจริงของพนักงานคนนี้ทันที
          จนกว่าจะกดออกจากโหมดนี้ ระบบจะบันทึกการเข้าสู่ระบบนี้ไว้
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={loading}>ยกเลิก</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm} disabled={loading}>
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default LoginAsDialog;
