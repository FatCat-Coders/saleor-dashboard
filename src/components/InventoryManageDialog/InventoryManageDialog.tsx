import { Avatar, InputAdornment, Typography } from "@material-ui/core";
import Button from "@material-ui/core/Button";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import CircularProgress from "@material-ui/core/CircularProgress";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Grid from "@material-ui/core/Grid";
import { makeStyles } from "@material-ui/core/styles";
import TextField from "@material-ui/core/TextField";
import Close from "@material-ui/icons/Close";
import SearchOutlined from "@material-ui/icons/SearchOutlined";
import Autocomplete, {
  createFilterOptions
} from "@material-ui/lab/Autocomplete";
import ToggleButton from "@material-ui/lab/ToggleButton";
import ToggleButtonGroup from "@material-ui/lab/ToggleButtonGroup";
import ConfirmButton from "@saleor/components/ConfirmButton";
import FormSpacer from "@saleor/components/FormSpacer";
import { createPaginationState } from "@saleor/hooks/usePaginator";
import { buttonMessages } from "@saleor/intl";
import { maybe } from "@saleor/misc";
import { useVariantUpdateMutation } from "@saleor/products/mutations";
import {
  fetchProductVariant,
  useProductListQueryWithMeta
} from "@saleor/products/queries";
import { ProductListVariables } from "@saleor/products/types/ProductList";
import { ProductListUrlSortField } from "@saleor/products/urls";
import { getFilterVariables } from "@saleor/products/views/ProductList/filters";
import { getSortQueryVariables } from "@saleor/products/views/ProductList/sort";
import { SearchProducts_search_edges_node } from "@saleor/searches/types/SearchProducts";
import { useMetadataUpdate } from "@saleor/utils/metadata/updateMetadata";
import React, { useCallback, useEffect, useState } from "react";
import { useApolloClient } from "react-apollo";
import { FormattedMessage, useIntl } from "react-intl";

import AddBarcodeDialog from "./AddBarcodeDialog";

export interface FormData {
  products: SearchProducts_search_edges_node[];
  query: string;
}

const useStyles = makeStyles(
  theme => ({
    adornment: {
      marginBottom: -16
    },
    avatar: {
      background: "none",
      border: `1px solid ${theme.palette.divider}`,
      borderRadius: 2,
      color: "#bdbdbd",
      height: 80,
      padding: theme.spacing(0.5),
      width: 80
    },
    card: {
      padding: 10,
      paddingBottom: "10px !important"
    },
    checkboxCell: {
      paddingLeft: 0,
      width: 88
    },
    colName: {
      paddingLeft: 0
    },
    rightAlign: {
      textAlign: "right"
    },
    root: {
      alignItems: "center",
      display: "flex",
      height: "100%",
      justifyContent: "center"
    }
  }),
  { name: "InventoryManageDialog" }
);

export interface InventoryManageDialogProps {
  open: boolean;
  onClose: () => void;
}

const filterOptions = createFilterOptions<{
  sku: string;
  name: string;
}>({
  limit: 10,
  stringify: option => `${option.sku} ${option.name}`
});

const InventoryManageDialog: React.FC<InventoryManageDialogProps> = props => {
  const { open, onClose } = props;
  const classes = useStyles(props);

  const apolloClient = useApolloClient();

  const [updateVariant] = useVariantUpdateMutation({});

  const [updateMetadata] = useMetadataUpdate({});

  const [mode, setMode] = useState("add");
  const [mainLoading, setMainLoading] = useState(true);
  const filter = getFilterVariables({});
  const sort = getSortQueryVariables({ sort: ProductListUrlSortField.name });
  const paginationState = createPaginationState(100, {});
  const [allProducts, setAllProducts] = useState([]);
  const [lastCursor, setLastCursor] = useState(null);
  const [product, setProduct] = useState(null);
  const [skuNotFound, setSkuNotFound] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [quantity, setQuantity] = useState("");
  const [updateLoading, setUpdateLoading] = useState(false);

  const [warningDialogOpen, setWarningDialogOpen] = useState(false);

  const handleBarcodeKeyPress = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const foundProduct = allProducts.find(p =>
          p.barcodes.includes(`${barcode}`.trim())
        );
        if (foundProduct) {
          setProduct(foundProduct);
          setSkuNotFound(false);
        } else {
          setProduct(null);
          setSkuNotFound(true);
        }

        setQuantity("");
      }
    },
    [allProducts, barcode]
  );

  const updateStocks = async () => {
    if (mode === "reduce" && quantity > product.stocks?.[0].quantity) {
      return;
    }
    const { data: productData } = await fetchProductVariant(
      apolloClient,
      product.id
    );
    const currentQuantity =
      productData.productVariant?.stocks?.[0]?.quantity || 0;
    if (product) {
      setUpdateLoading(true);
      if (skuNotFound) {
        const currentBarcodes = (
          productData.productVariant.metadata.find(m => m.key === "barcode")
            ?.value || ""
        )?.split("|");
        if (!currentBarcodes.includes(`${barcode}`.trim())) {
          currentBarcodes.push(`${barcode}`.trim());
        }
        await updateMetadata({
          variables: {
            id: product.id,
            input: [
              {
                key: "barcode",
                value: currentBarcodes.join("|")
              }
            ],
            keysToDelete: []
          }
        });
        product.barcodes = currentBarcodes;
      }

      const updatedProduct = await updateVariant({
        variables: {
          addStocks: [],
          id: product.id,
          removeStocks: [],
          stocks: [
            {
              quantity:
                currentQuantity +
                (mode === "add"
                  ? parseInt(quantity, 10)
                  : -parseInt(quantity, 10)),
              warehouse: product.stocks?.[0]?.warehouse?.id
            }
          ],
          trackInventory: true
        }
      });
      product.stocks =
        updatedProduct.data.productVariantStocksUpdate.productVariant.stocks;
      setQuantity("");
      setProduct(null);
      setSkuNotFound(false);
      setBarcode("");
      setUpdateLoading(false);
      barcodeInput.current.querySelector("input").focus();
    }
  };

  const handleQuantityKeyPress = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter") {
        updateStocks();
      }
    },
    [product, quantity, mode]
  );

  const handleBack = useCallback(() => {
    setBarcode("");
    setQuantity("");
    setSkuNotFound(false);
    setProduct(null);
    setMode("add");
    onClose();
  }, []);

  const onSkuChange = useCallback((_, item) => {
    setProduct(item);
    if (item?.barcodes.length > 0) {
      setWarningDialogOpen(true);
    }
  }, []);

  const onBarcodeChange = useCallback(event => {
    setBarcode(event.target.value);
  }, []);

  const onQuantityChange = useCallback(event => {
    setQuantity(event.target.value);
  }, []);

  const onRemoveClick = useCallback(() => {
    setProduct(null);
    skuInput.current.querySelector("input").focus();
    skuInput.current.querySelector("input").select();
  }, []);

  const onReplaceBarcodeClose = useCallback(() => {
    setProduct(null);

    setWarningDialogOpen(false);

    setTimeout(() => {
      skuInput.current.querySelector("input").focus();
      skuInput.current.querySelector("input").select();
    }, 0);
  }, []);

  const queryVariables = React.useMemo<ProductListVariables>(
    () => ({
      ...paginationState,
      filter,
      sort
    }),
    []
  );

  const { data, loadMore } = useProductListQueryWithMeta({
    displayLoader: true,
    variables: queryVariables
  });

  useEffect(() => {
    if (data && data.products.pageInfo.endCursor !== lastCursor) {
      setLastCursor(data.products.pageInfo.endCursor);
      const variants = data.products.edges.reduce(
        (prev, edge) => [
          ...prev,
          ...edge.node.variants.map(variant => ({
            ...variant,
            barcodes:
              variant.metadata
                .find(metadata => metadata.key === "barcode")
                ?.value?.split("|") || [],
            name: edge.node.name,
            productId: edge.node.id,
            productType: edge.node.productType,
            thumbnail: edge.node.thumbnail
          }))
        ],
        []
      );
      setAllProducts([...allProducts, ...variants]);
      if (data.products.pageInfo.hasNextPage) {
        loadMore(
          (prev, next) => {
            if (
              prev.products.pageInfo.endCursor ===
              next.products.pageInfo.endCursor
            ) {
              return prev;
            }

            return next;
          },
          {
            after: data.products.pageInfo.endCursor
          }
        );
      }
    }

    if (data && !data.products.pageInfo.hasNextPage) {
      setMainLoading(false);
    }
  }, [loadMore, data, lastCursor]);

  const intl = useIntl();
  const container = React.useRef<HTMLDivElement>();
  const skuInput = React.useRef<HTMLDivElement>();
  const barcodeInput = React.useRef<HTMLDivElement>();
  const quantityInput = React.useRef<HTMLDivElement>();

  const label = product?.attributes?.[0].attribute.metadata?.find(
    meta => meta.key === "label"
  )?.value;
  const type = product?.productType.name;
  const variantName = product?.attributes?.[0].values?.[0].name?.replace(
    /_/,
    "."
  );
  const labels = [];
  const variantLabels = [product?.name];
  if (type !== "Placeholder") {
    labels.push(type);
    labels.push(`${variantName} ${label}`);
    variantLabels.push(`${variantName} ${label}`);
  } else {
    labels.push(variantName);
    variantLabels.push(variantName);
  }

  return (
    <Dialog onClose={handleBack} open={open} fullWidth maxWidth="sm">
      <AddBarcodeDialog
        variantName={variantLabels.join(" · ")}
        onClose={onReplaceBarcodeClose}
        onConfirm={() => {
          setWarningDialogOpen(false);
          quantityInput.current.querySelector("input").focus();
        }}
        open={warningDialogOpen}
      />
      <DialogTitle>
        <FormattedMessage
          defaultMessage="Inventory"
          description="dialog header"
        />
      </DialogTitle>
      <DialogContent ref={container}>
        {mainLoading && (
          <div className={classes.root}>
            <CircularProgress size={128} />
          </div>
        )}
        {!mainLoading && (
          <>
            <Grid container spacing={0} direction="row" justify="center">
              <ToggleButtonGroup
                value={mode}
                exclusive
                onChange={(_, value) => {
                  setMode(value);
                }}
                aria-label="mode"
              >
                <ToggleButton value="add" aria-label="add">
                  Add
                </ToggleButton>
                <ToggleButton value="reduce" aria-label="reduce">
                  Reduce
                </ToggleButton>
              </ToggleButtonGroup>
            </Grid>
            <FormSpacer />

            <TextField
              name="barcode"
              value={barcode}
              ref={barcodeInput}
              disabled={updateLoading}
              onChange={onBarcodeChange}
              onKeyPress={handleBarcodeKeyPress}
              autoFocus
              label={intl.formatMessage({
                defaultMessage: "Scan or enter a barcode"
              })}
              fullWidth
              InputProps={{
                autoComplete: "off"
                // endAdornment: loading && <CircularProgress size={16} />
              }}
              error={skuNotFound}
              helperText={
                skuNotFound
                  ? "Barcode not found, please assign the product variant."
                  : undefined
              }
            />
            <FormSpacer />

            <div>
              {skuNotFound && (
                <>
                  <Autocomplete
                    autoHighlight
                    id="sku-search"
                    onChange={onSkuChange}
                    options={allProducts}
                    filterOptions={filterOptions}
                    renderOption={option => {
                      const optionLabel = option?.attributes?.[0].attribute.metadata?.find(
                        meta => meta.key === "label"
                      )?.value;
                      const optionType = option?.productType.name;
                      const optionVariantName = option?.attributes?.[0].values?.[0].name?.replace(
                        /_/,
                        "."
                      );
                      const optionLabels = [];
                      if (optionType !== "Placeholder") {
                        optionLabels.push(optionType);
                        optionLabels.push(
                          `${optionVariantName} ${optionLabel}`
                        );
                      } else {
                        optionLabels.push(optionVariantName);
                      }
                      return (
                        <Grid container>
                          <Grid item xs={2}>
                            <Avatar
                              className={classes.avatar}
                              src={maybe(() => option.thumbnail.url)}
                            />
                          </Grid>
                          <Grid item xs={10}>
                            <div>
                              <Typography variant="subtitle1">
                                {option.name}
                              </Typography>
                            </div>
                            <div>
                              <Typography variant="subtitle2">
                                {optionLabels.join(" · ")}
                              </Typography>
                            </div>
                            <div>
                              <Typography variant="caption">
                                SKU #{option.sku}
                              </Typography>
                            </div>
                          </Grid>
                        </Grid>
                      );
                    }}
                    getOptionLabel={option => option.name}
                    renderInput={params => (
                      <TextField
                        {...params}
                        fullWidth
                        disabled={updateLoading}
                        autoFocus
                        name="sku"
                        ref={skuInput}
                        label="Enter SKU or name of an item"
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <InputAdornment
                              className={classes.adornment}
                              position="start"
                            >
                              <SearchOutlined />
                            </InputAdornment>
                          )
                        }}
                        variant="outlined"
                      />
                    )}
                  />
                  <FormSpacer />
                </>
              )}
              {product && (
                <>
                  <Grid container>
                    <Grid item xs={2}>
                      <Avatar
                        className={classes.avatar}
                        src={maybe(() => product.thumbnail.url)}
                      />
                    </Grid>
                    <Grid item xs={skuNotFound ? 7 : 8}>
                      <div>
                        <Typography variant="subtitle1">
                          {product.name}
                        </Typography>
                      </div>
                      <div>
                        <Typography variant="subtitle2">
                          {labels.join(" · ")}
                        </Typography>
                      </div>
                      <div>
                        <Typography variant="caption">
                          SKU #{product.sku}
                        </Typography>
                      </div>
                    </Grid>
                    <Grid item xs={2}>
                      <Card variant="outlined">
                        <CardContent className={classes.card}>
                          <Typography color="textSecondary" gutterBottom>
                            In stock
                          </Typography>
                          <Typography variant="h5" component="h2">
                            {product.stocks?.[0].quantity}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    {skuNotFound && (
                      <Grid item xs={1} className={classes.rightAlign}>
                        <Close onClick={onRemoveClick} />
                      </Grid>
                    )}
                  </Grid>
                  <FormSpacer />
                  <TextField
                    name="quantity"
                    ref={quantityInput}
                    type="number"
                    disabled={updateLoading}
                    value={quantity}
                    onChange={onQuantityChange}
                    onKeyPress={handleQuantityKeyPress}
                    autoFocus
                    label={intl.formatMessage({
                      defaultMessage: "Enter quantity"
                    })}
                    fullWidth
                    InputProps={{
                      autoComplete: "off"
                      // endAdornment: loading && <CircularProgress size={16} />
                    }}
                  />
                </>
              )}
              <FormSpacer />
            </div>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleBack}>
          <FormattedMessage {...buttonMessages.back} />
        </Button>
        <ConfirmButton
          transitionState={"default"}
          color={mode === "add" ? "primary" : "secondary"}
          variant="contained"
          type="submit"
          onClick={updateStocks}
          disabled={
            mainLoading ||
            !quantity ||
            updateLoading ||
            (mode === "reduce" && quantity > product.stocks?.[0].quantity)
          }
        >
          {mode === "add" ? "Add" : "Reduce"}
        </ConfirmButton>
      </DialogActions>
    </Dialog>
  );
};
InventoryManageDialog.displayName = "InventoryManageDialog";
export default InventoryManageDialog;
