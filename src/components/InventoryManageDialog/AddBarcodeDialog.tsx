import DialogContentText from "@material-ui/core/DialogContentText";
import ActionDialog from "@saleor/components/ActionDialog";
import React from "react";
import { FormattedMessage, useIntl } from "react-intl";

export interface AppActivateDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  variantName: string;
}

const AddBarcodeDialog: React.FC<AppActivateDialogProps> = ({
  open,
  onClose,
  onConfirm,
  variantName
}) => {
  const intl = useIntl();

  return (
    <ActionDialog
      confirmButtonLabel={intl.formatMessage({
        defaultMessage: "Add",
        description: "button label"
      })}
      confirmButtonState="default"
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={intl.formatMessage({
        defaultMessage: "Product already has a barcode",
        description: "dialog header"
      })}
      variant="default"
    >
      <DialogContentText>
        <FormattedMessage
          defaultMessage="Are you sure you want to add this barcode to {name}"
          description="replace barcode"
          values={{
            name: variantName
          }}
        />
      </DialogContentText>
    </ActionDialog>
  );
};
AddBarcodeDialog.displayName = "AddBarcodeDialog";
export default AddBarcodeDialog;
