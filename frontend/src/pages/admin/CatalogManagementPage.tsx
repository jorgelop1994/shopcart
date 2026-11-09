import React, { useCallback, useEffect, useState } from 'react';
import {
  Edit3,
  FolderTree,
  ImagePlus,
  Layers,
  PackagePlus,
  Plus,
  Search,
  Tags,
  Trash2,
} from 'lucide-react';
import { catalogApi } from '../../api/catalog.api';
import { HttpError } from '../../api/httpClient';
import { useToast } from '../../context/ToastContext';
import {
  AttributeGroup,
  CategoryRecord,
  PaginationMeta,
  ProductDetailRecord,
  ProductSummaryRecord,
  ProductVariantRecord,
} from '../../types/api.types';
import { formatGTQ } from '../../utils/format';
import { ServerDataTable, TableColumn } from '../../components/ui/ServerDataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ModalDialog } from '../../components/ui/ModalDialog';
import { FormField } from '../../components/ui/FormField';

export const CatalogManagementPage: React.FC = () => {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products');

  // Datos maestros
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [attributes, setAttributes] = useState<AttributeGroup[]>([]);

  // Listado de productos en servidor
  const [products, setProducts] = useState<ProductSummaryRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    pagina: 1,
    tamanoPagina: 10,
    totalRegistros: 0,
    totalPaginas: 0,
  });
  const [loadingProducts, setLoadingProducts] = useState<boolean>(true);
  const [productError, setProductError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('recientes');

  // Modal Crear/Editar Producto
  const [productModalOpen, setProductModalOpen] = useState<boolean>(false);
  const [editingProductId, setEditingProductId] = useState<number | undefined>(undefined);
  const [prodCategory, setProdCategory] = useState<number>(1);
  const [prodName, setProdName] = useState<string>('');
  const [prodBrand, setProdBrand] = useState<string>('');
  const [prodDesc, setProdDesc] = useState<string>('');
  const [prodActive, setProdActive] = useState<boolean>(true);
  const [savingProduct, setSavingProduct] = useState<boolean>(false);

  // Modal Gestionar Variantes e Imágenes de un Producto
  const [selectedProductDetail, setSelectedProductDetail] =
    useState<ProductDetailRecord | null>(null);
  const [variantsModalOpen, setVariantsModalOpen] = useState<boolean>(false);
  const [editingVariantId, setEditingVariantId] = useState<number | undefined>(undefined);
  const [varSku, setVarSku] = useState<string>('');
  const [varName, setVarName] = useState<string>('');
  const [varPrice, setVarPrice] = useState<string>('199.00');
  const [varInitialStock, setVarInitialStock] = useState<string>('15');
  const [varActive, setVarActive] = useState<boolean>(true);
  const [varAttrValues, setVarAttrValues] = useState<number[]>([]);
  const [savingVariant, setSavingVariant] = useState<boolean>(false);

  // Formulario de imagen dentro del modal de variantes
  const [imgUrl, setImgUrl] = useState<string>('');
  const [imgAlt, setImgAlt] = useState<string>('');
  const [imgPrimary, setImgPrimary] = useState<boolean>(false);
  const [savingImage, setSavingImage] = useState<boolean>(false);

  // Modal Crear/Editar Categoría
  const [categoryModalOpen, setCategoryModalOpen] = useState<boolean>(false);
  const [editingCatId, setEditingCatId] = useState<number | undefined>(undefined);
  const [catName, setCatName] = useState<string>('');
  const [catDesc, setCatDesc] = useState<string>('');
  const [catActive, setCatActive] = useState<boolean>(true);
  const [savingCategory, setSavingCategory] = useState<boolean>(false);

  // Formulario de Atributo/Valor
  const [attrName, setAttrName] = useState<string>('Color');
  const [attrVal, setAttrVal] = useState<string>('');
  const [savingAttr, setSavingAttr] = useState<boolean>(false);

  const loadCategoriesAndAttributes = useCallback(async () => {
    try {
      const [cats, attrs] = await Promise.all([
        catalogApi.listCategories(false),
        catalogApi.listAttributes(),
      ]);
      setCategories(cats);
      setAttributes(attrs);
      if (cats.length > 0 && !prodCategory) {
        setProdCategory(cats[0].IDCategoria);
      }
    } catch {
      // Manejado silenciosamente en carga auxiliar
    }
  }, [prodCategory]);

  const fetchProducts = useCallback(
    async (page = pagination.pagina) => {
      setLoadingProducts(true);
      setProductError(null);
      try {
        const res = await catalogApi.listProducts({
          pagina: page,
          tamanoPagina: 10,
          idCategoria: categoryFilter ? Number(categoryFilter) : undefined,
          busqueda: search.trim() || undefined,
          ordenarPor: sortBy,
          soloActivos: false,
        });
        setProducts(res.items);
        setPagination(res.pagination);
      } catch (err) {
        setProductError(
          err instanceof HttpError ? err.message : 'Error al cargar el catálogo de productos.'
        );
      } finally {
        setLoadingProducts(false);
      }
    },
    [pagination.pagina, categoryFilter, search, sortBy]
  );

  useEffect(() => {
    void loadCategoriesAndAttributes();
  }, [loadCategoriesAndAttributes]);

  useEffect(() => {
    void fetchProducts(1);
  }, [categoryFilter, sortBy, fetchProducts]);

  const handleOpenNewProduct = () => {
    setEditingProductId(undefined);
    setProdCategory(categories[0]?.IDCategoria ?? 1);
    setProdName('');
    setProdBrand('');
    setProdDesc('');
    setProdActive(true);
    setProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: ProductSummaryRecord) => {
    setEditingProductId(prod.IDProducto);
    setProdCategory(prod.IDCategoria);
    setProdName(prod.Nombre);
    setProdBrand(prod.Marca ?? '');
    setProdDesc(prod.Descripcion ?? '');
    setProdActive(prod.Activo);
    setProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProduct(true);
    try {
      await catalogApi.saveProduct({
        idProducto: editingProductId,
        idCategoria: prodCategory,
        nombre: prodName.trim(),
        marca: prodBrand.trim() || null,
        descripcion: prodDesc.trim() || null,
        activo: prodActive,
      });
      setProductModalOpen(false);
      showToast(
        editingProductId
          ? 'Producto actualizado correctamente.'
          : 'Producto creado. Ahora puedes agregarle variantes con SKU e inventario inicial.',
        'success'
      );
      await fetchProducts(pagination.pagina);
      await loadCategoriesAndAttributes();
    } catch (err) {
      showToast(
        err instanceof HttpError ? err.message : 'No fue posible guardar el producto.',
        'error'
      );
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteOrDeactivateProduct = async (prod: ProductSummaryRecord) => {
    try {
      const result = await catalogApi.deleteOrDeactivateProduct(prod.IDProducto);
      showToast(
        `${result.AccionAplicada ?? result.AccionTomada}: ${result.Mensaje}`,
        'info'
      );
      await fetchProducts(pagination.pagina);
    } catch (err) {
      showToast(
        err instanceof HttpError
          ? err.message
          : 'No fue posible eliminar o desactivar el producto.',
        'error'
      );
    }
  };

  const handleOpenVariantsModal = async (idProducto: number) => {
    try {
      const detail = await catalogApi.getProductById(idProducto);
      setSelectedProductDetail(detail);
      resetVariantForm();
      setVariantsModalOpen(true);
    } catch (err) {
      showToast(
        err instanceof HttpError ? err.message : 'No se pudo cargar el detalle del producto.',
        'error'
      );
    }
  };

  const resetVariantForm = () => {
    setEditingVariantId(undefined);
    setVarSku(`SKU-${Math.floor(1000 + Math.random() * 9000)}`);
    setVarName('');
    setVarPrice('250.00');
    setVarInitialStock('10');
    setVarActive(true);
    setVarAttrValues([]);
  };

  const handleSelectVariantForEdit = (v: ProductVariantRecord) => {
    setEditingVariantId(v.IDVariante);
    setVarSku(v.SKU);
    setVarName(v.NombreVariante);
    setVarPrice(String(v.Precio));
    setVarInitialStock('0');
    setVarActive(v.Activa);
    setVarAttrValues(v.Atributos ? v.Atributos.map((a) => a.IDValorAtributo) : []);
  };

  const handleSaveVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductDetail) return;
    const priceNum = Number(varPrice);
    if (Number.isNaN(priceNum) || priceNum <= 0) {
      showToast('El precio de la variante debe ser mayor a Q 0.00.', 'warning');
      return;
    }

    setSavingVariant(true);
    try {
      await catalogApi.saveVariant({
        idVariante: editingVariantId,
        idProducto: selectedProductDetail.IDProducto,
        sku: varSku.trim().toUpperCase(),
        nombreVariante: varName.trim(),
        precio: priceNum,
        existenciaInicial: editingVariantId ? 0 : Math.max(0, Number(varInitialStock) || 0),
        activa: varActive,
        idsValoresAtributo: varAttrValues.length > 0 ? varAttrValues : undefined,
      });
      const updatedDetail = await catalogApi.getProductById(selectedProductDetail.IDProducto);
      setSelectedProductDetail(updatedDetail);
      resetVariantForm();
      showToast(
        editingVariantId
          ? 'Variante actualizada exitosamente.'
          : 'Variante creada y stock inicial registrado en Kardex.',
        'success'
      );
      await fetchProducts(pagination.pagina);
    } catch (err) {
      showToast(
        err instanceof HttpError ? err.message : 'Error al guardar la variante.',
        'error'
      );
    } finally {
      setSavingVariant(false);
    }
  };

  const handleAddImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductDetail || !imgUrl.trim()) return;
    setSavingImage(true);
    try {
      await catalogApi.addProductImage(selectedProductDetail.IDProducto, {
        urlImagen: imgUrl.trim(),
        textoAlternativo: imgAlt.trim() || selectedProductDetail.Nombre,
        orden: (selectedProductDetail.imagenes.length || 0) + 1,
        esPrincipal: imgPrimary,
      });
      const updated = await catalogApi.getProductById(selectedProductDetail.IDProducto);
      setSelectedProductDetail(updated);
      setImgUrl('');
      setImgAlt('');
      setImgPrimary(false);
      showToast('Imagen asociada al producto.', 'success');
      await fetchProducts(pagination.pagina);
    } catch (err) {
      showToast(
        err instanceof HttpError ? err.message : 'No se pudo asociar la imagen.',
        'error'
      );
    } finally {
      setSavingImage(false);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCategory(true);
    try {
      await catalogApi.saveCategory({
        idCategoria: editingCatId,
        nombre: catName.trim(),
        descripcion: catDesc.trim() || null,
        activa: catActive,
      });
      setCategoryModalOpen(false);
      showToast(
        editingCatId ? 'Categoría actualizada.' : 'Categoría creada exitosamente.',
        'success'
      );
      await loadCategoriesAndAttributes();
      await fetchProducts(pagination.pagina);
    } catch (err) {
      showToast(
        err instanceof HttpError ? err.message : 'Error al guardar la categoría.',
        'error'
      );
    } finally {
      setSavingCategory(false);
    }
  };

  const handleSaveAttributeValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attrName.trim() || !attrVal.trim()) return;
    setSavingAttr(true);
    try {
      await catalogApi.saveAttributeValue({
        nombreAtributo: attrName.trim(),
        valor: attrVal.trim(),
      });
      setAttrVal('');
      showToast(`Valor "${attrVal}" agregado al atributo "${attrName}".`, 'success');
      await loadCategoriesAndAttributes();
    } catch (err) {
      showToast(
        err instanceof HttpError ? err.message : 'Error al registrar valor de atributo.',
        'error'
      );
    } finally {
      setSavingAttr(false);
    }
  };

  const productColumns: TableColumn<ProductSummaryRecord>[] = [
    {
      id: 'producto',
      header: 'Producto / Marca',
      sortKey: 'nombre',
      render: (row) => (
        <div className="flex items-center gap-3">
          {row.ImagenPrincipal ? (
            <img
              src={row.ImagenPrincipal}
              alt={row.Nombre}
              className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
              IMG
            </div>
          )}
          <div>
            <span className="font-bold text-slate-900 block">{row.Nombre}</span>
            <span className="text-xs text-slate-500">
              {row.Marca ?? 'Sin marca'} • ID #{row.IDProducto}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'categoria',
      header: 'Categoría',
      render: (row) => <span className="text-xs font-semibold text-slate-700">{row.NombreCategoria}</span>,
    },
    {
      id: 'precios',
      header: 'Rango Precios (GTQ)',
      align: 'right',
      sortKey: 'precio',
      render: (row) => (
        <span className="font-bold text-slate-900">
          {row.PrecioMinimo === row.PrecioMaximo
            ? formatGTQ(row.PrecioMinimo)
            : `${formatGTQ(row.PrecioMinimo)} - ${formatGTQ(row.PrecioMaximo)}`}
        </span>
      ),
    },
    {
      id: 'variantes',
      header: 'Variantes / Stock Disp.',
      align: 'center',
      render: (row) => (
        <div className="text-xs">
          <span className="font-bold text-slate-900">{row.TotalVariantesActivas} var.</span>
          <span className="block text-emerald-700 font-semibold">
            {row.ExistenciaDisponibleTotal} disp.
          </span>
        </div>
      ),
    },
    {
      id: 'estado',
      header: 'Estado',
      align: 'center',
      render: (row) => <StatusBadge status={row.Activo ? 'ACTIVO' : 'INACTIVO'} />,
    },
    {
      id: 'acciones',
      header: 'Acciones',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => void handleOpenVariantsModal(row.IDProducto)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            Variantes
          </button>
          <button
            type="button"
            onClick={() => handleOpenEditProduct(row)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
            title="Editar Producto"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void handleDeleteOrDeactivateProduct(row)}
            className="p-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer"
            title="Eliminar o Desactivar según historial de ventas (RF-02)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <FolderTree className="w-6 h-6 text-indigo-600" />
            Administración de Catálogo, Variantes y Categorías
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Gestión de productos, variantes con SKU único, imágenes y categorías con protección de
            integridad histórica (`RF-02`).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingCatId(undefined);
              setCatName('');
              setCatDesc('');
              setCatActive(true);
              setCategoryModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs font-bold hover:bg-slate-50 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nueva Categoría
          </button>
          <button
            type="button"
            onClick={handleOpenNewProduct}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 cursor-pointer"
          >
            <PackagePlus className="w-4 h-4" />
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* Pestañas */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'products'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Productos y Variantes ({pagination.totalRegistros})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'categories'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Categorías ({categories.length}) y Atributos ({attributes.length})
        </button>
      </div>

      {activeTab === 'products' ? (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label htmlFor="cat-prod-search" className="block text-xs font-semibold text-slate-700 mb-1">
                Buscar Producto, Marca o SKU
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="cat-prod-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void fetchProducts(1);
                  }}
                  placeholder="Ej. Laptop, Sony, SKU..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div className="w-full sm:w-48">
              <label htmlFor="cat-prod-filter" className="block text-xs font-semibold text-slate-700 mb-1">
                Categoría
              </label>
              <select
                id="cat-prod-filter"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Todas</option>
                {categories.map((c) => (
                  <option key={c.IDCategoria} value={c.IDCategoria}>
                    {c.Nombre} {!c.Activa ? '(Inactiva)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full sm:w-48">
              <label htmlFor="cat-prod-sort" className="block text-xs font-semibold text-slate-700 mb-1">
                Ordenar por
              </label>
              <select
                id="cat-prod-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="recientes">Más recientes</option>
                <option value="nombre_asc">Nombre (A-Z)</option>
                <option value="precio_asc">Menor precio</option>
                <option value="precio_desc">Mayor precio</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => void fetchProducts(1)}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
            >
              Buscar
            </button>
          </div>

          <ServerDataTable
            caption="Catálogo maestro de productos para administración"
            columns={productColumns}
            data={products}
            keyExtractor={(row) => row.IDProducto}
            pagination={pagination}
            onPageChange={(page) => void fetchProducts(page)}
            sortKey={
              sortBy.startsWith('precio')
                ? 'precio'
                : sortBy === 'nombre_asc'
                  ? 'nombre'
                  : undefined
            }
            sortDirection={sortBy === 'precio_desc' ? 'desc' : 'asc'}
            onSortChange={(key) => {
              if (key === 'precio') {
                setSortBy((prev) => (prev === 'precio_asc' ? 'precio_desc' : 'precio_asc'));
              } else {
                setSortBy('nombre_asc');
              }
            }}
            loading={loadingProducts}
            error={productError}
            onRetry={() => void fetchProducts(pagination.pagina)}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tabla de Categorías */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Categorías del Catálogo (`Categorias`)
            </h2>
            <p className="text-xs text-slate-500">
              Al desactivar una categoría, todos sus productos dejan de mostrarse automáticamente en
              el catálogo público del cliente (`RF-02`).
            </p>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                    <th className="py-2.5 px-3">ID / Nombre</th>
                    <th className="py-2.5 px-3">Descripción</th>
                    <th className="py-2.5 px-3 text-center">Productos</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                    <th className="py-2.5 px-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {categories.map((cat) => (
                    <tr key={cat.IDCategoria}>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        #{cat.IDCategoria} — {cat.Nombre}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{cat.Descripcion ?? '—'}</td>
                      <td className="py-2.5 px-3 text-center font-semibold">
                        {cat.TotalProductos}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <StatusBadge status={cat.Activa ? 'ACTIVO' : 'INACTIVO'} />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCatId(cat.IDCategoria);
                            setCatName(cat.Nombre);
                            setCatDesc(cat.Descripcion ?? '');
                            setCatActive(cat.Activa);
                            setCategoryModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Diccionario de Atributos de Variantes */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Tags className="w-4 h-4 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">Atributos de Variantes</h2>
            </div>

            <form onSubmit={handleSaveAttributeValue} className="space-y-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <FormField
                id="attr-name-input"
                label="Nombre del Atributo (Ej. Color, Talla, Capacidad)"
                value={attrName}
                onChange={(e) => setAttrName(e.target.value)}
                required
              />
              <FormField
                id="attr-val-input"
                label="Nuevo Valor (Ej. Azul Marino, 512GB)"
                value={attrVal}
                onChange={(e) => setAttrVal(e.target.value)}
                required
              />
              <button
                type="submit"
                disabled={savingAttr}
                className="w-full py-2 px-3 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
              >
                {savingAttr ? 'Guardando...' : 'Agregar Valor de Atributo'}
              </button>
            </form>

            <div className="space-y-3">
              {attributes.map((attr) => (
                <div key={attr.idAtributo} className="p-3 rounded-xl border border-slate-200 text-xs">
                  <span className="font-bold text-slate-900 block mb-1.5">
                    {attr.nombreAtributo}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {attr.valores.map((v) => (
                      <span
                        key={v.IDValorAtributo}
                        className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium"
                      >
                        {v.Valor}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear/Editar Producto */}
      <ModalDialog
        open={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        title={editingProductId ? `Editar Producto #${editingProductId}` : 'Crear Nuevo Producto'}
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          <div>
            <label htmlFor="prod-cat-select" className="block text-sm font-medium text-slate-800 mb-1.5">
              Categoría <span className="text-rose-600">*</span>
            </label>
            <select
              id="prod-cat-select"
              value={prodCategory}
              onChange={(e) => setProdCategory(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
            >
              {categories.map((c) => (
                <option key={c.IDCategoria} value={c.IDCategoria}>
                  {c.Nombre}
                </option>
              ))}
            </select>
          </div>

          <FormField
            id="prod-name-input"
            label="Nombre Comercial del Producto"
            value={prodName}
            onChange={(e) => setProdName(e.target.value)}
            required
          />

          <FormField
            id="prod-brand-input"
            label="Marca / Fabricante"
            value={prodBrand}
            onChange={(e) => setProdBrand(e.target.value)}
          />

          <FormField
            id="prod-desc-input"
            label="Descripción Detallada"
            as="textarea"
            value={prodDesc}
            onChange={(e) => setProdDesc(e.target.value)}
          />

          <label className="flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={prodActive}
              onChange={(e) => setProdActive(e.target.checked)}
              className="rounded text-indigo-600"
            />
            Producto activo y visible en tienda
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setProductModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingProduct}
              className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
            >
              {savingProduct ? 'Guardando...' : 'Guardar Producto'}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal Gestionar Variantes e Imágenes */}
      <ModalDialog
        open={variantsModalOpen && Boolean(selectedProductDetail)}
        onClose={() => setVariantsModalOpen(false)}
        title={
          selectedProductDetail
            ? `Variantes e Imágenes — ${selectedProductDetail.Nombre}`
            : 'Variantes del Producto'
        }
        maxWidthClass="max-w-4xl"
      >
        {selectedProductDetail && (
          <div className="space-y-6">
            {/* Listado de variantes actuales */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Variantes Registradas (`VariantesProducto`)
                </h3>
                {editingVariantId && (
                  <button
                    type="button"
                    onClick={resetVariantForm}
                    className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                  >
                    + Cambiar a Modo Crear Nueva Variante
                  </button>
                )}
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                      <th className="py-2 px-3">SKU</th>
                      <th className="py-2 px-3">Variante / Atributos</th>
                      <th className="py-2 px-3 text-right">Precio (IVA 12% incl.)</th>
                      <th className="py-2 px-3 text-center">Stock Disp.</th>
                      <th className="py-2 px-3 text-center">Estado</th>
                      <th className="py-2 px-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedProductDetail.variantes.map((v) => (
                      <tr key={v.IDVariante}>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900">{v.SKU}</td>
                        <td className="py-2 px-3">
                          <span className="font-semibold text-slate-900">{v.NombreVariante}</span>
                          {v.Atributos && v.Atributos.length > 0 && (
                            <span className="block text-[11px] text-slate-500">
                              {v.Atributos.map((a) => `${a.Atributo}: ${a.Valor}`).join(' • ')}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-indigo-700">
                          {formatGTQ(v.Precio)}
                        </td>
                        <td className="py-2 px-3 text-center font-semibold">
                          {v.ExistenciaDisponible} (Fís: {v.ExistenciaFisica})
                        </td>
                        <td className="py-2 px-3 text-center">
                          <StatusBadge status={v.Activa ? 'ACTIVO' : 'INACTIVO'} />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleSelectVariantForEdit(v)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Formulario Crear/Editar Variante */}
            <form
              onSubmit={handleSaveVariant}
              className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4"
            >
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                {editingVariantId
                  ? `Editando Variante #${editingVariantId}`
                  : 'Agregar Nueva Variante con SKU Único'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <FormField
                  id="var-sku"
                  label="Código SKU Único"
                  value={varSku}
                  onChange={(e) => setVarSku(e.target.value)}
                  required
                />
                <FormField
                  id="var-name"
                  label="Nombre Variante"
                  value={varName}
                  onChange={(e) => setVarName(e.target.value)}
                  placeholder="Ej. Negro Mate - 256GB"
                  required
                />
                <FormField
                  id="var-price"
                  label="Precio GTQ (> 0)"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={varPrice}
                  onChange={(e) => setVarPrice(e.target.value)}
                  required
                />
                {!editingVariantId ? (
                  <FormField
                    id="var-stock"
                    label="Stock Inicial (Kardex)"
                    type="number"
                    min="0"
                    value={varInitialStock}
                    onChange={(e) => setVarInitialStock(e.target.value)}
                    required
                  />
                ) : (
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={varActive}
                        onChange={(e) => setVarActive(e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      Variante Activa
                    </label>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingVariant}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                >
                  {savingVariant
                    ? 'Guardando...'
                    : editingVariantId
                      ? 'Actualizar Variante'
                      : 'Crear Variante'}
                </button>
              </div>
            </form>

            {/* Imágenes del Producto */}
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ImagePlus className="w-4 h-4 text-indigo-600" />
                Galería de Imágenes del Producto ({selectedProductDetail.imagenes.length})
              </h4>
              <form onSubmit={handleAddImage} className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[240px]">
                  <FormField
                    id="img-url-input"
                    label="URL de la Imagen"
                    type="url"
                    value={imgUrl}
                    onChange={(e) => setImgUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    required
                  />
                </div>
                <div className="w-full sm:w-52">
                  <FormField
                    id="img-alt-input"
                    label="Texto Alternativo"
                    value={imgAlt}
                    onChange={(e) => setImgAlt(e.target.value)}
                  />
                </div>
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 pb-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={imgPrimary}
                    onChange={(e) => setImgPrimary(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  Principal
                </label>
                <button
                  type="submit"
                  disabled={savingImage}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
                >
                  Agregar Imagen
                </button>
              </form>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* Modal Crear/Editar Categoría */}
      <ModalDialog
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title={editingCatId ? `Editar Categoría #${editingCatId}` : 'Nueva Categoría'}
      >
        <form onSubmit={handleSaveCategory} className="space-y-4">
          <FormField
            id="cat-name-input"
            label="Nombre de la Categoría"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            required
          />
          <FormField
            id="cat-desc-input"
            label="Descripción"
            as="textarea"
            value={catDesc}
            onChange={(e) => setCatDesc(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={catActive}
              onChange={(e) => setCatActive(e.target.checked)}
              className="rounded text-indigo-600"
            />
            Categoría activa (Si se desactiva, sus productos se ocultan del catálogo público)
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCategoryModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingCategory}
              className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
            >
              {savingCategory ? 'Guardando...' : 'Guardar Categoría'}
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
};
