import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  onConfirm: () => void;
}

const DeleteEmployeeDialog = ({ open, onOpenChange, employeeName, onConfirm }: DeleteEmployeeDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>ยืนยันการลบพนักงาน</AlertDialogTitle>
        <AlertDialogDescription>
          คุณต้องการลบข้อมูลของ <span className="font-semibold text-foreground">{employeeName}</span> ใช่หรือไม่?
          การดำเนินการนี้ไม่สามารถย้อนกลับได้
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
          ลบพนักงาน
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default DeleteEmployeeDialog;
