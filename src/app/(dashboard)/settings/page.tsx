"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FolderTree, Save, Plus, Trash2, Pencil, X, Check,
  Package, AlertTriangle, ChevronUp, ChevronDown, Info,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  order: number;
  _count?: { products: number };
}

export default function SettingsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  /* edición inline */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editError, setEditError] = useState("");

  const fetchCategories = useCallback(async () => {
    const res = await fetch("/api/categories");
    const data = await res.json();
    setCategories(data);
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const flash = (msg: string, isError = false) => {
    if (isError) setError(msg);
    else setOkMsg(msg);
    setTimeout(() => { setError(""); setOkMsg(""); }, 3500);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewName("");
        setNewDesc("");
        flash(`Categoría "${data.name}" creada`);
        fetchCategories();
      } else {
        setError(data.error || "Error al crear");
      }
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditDesc(cat.description || "");
    setEditError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditDesc("");
    setEditError("");
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) { setEditError("El nombre es requerido"); return; }
    setEditError("");
    try {
      const res = await fetch("/api/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editName.trim(), description: editDesc.trim() || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setEditingId(null);
        flash("Categoría actualizada");
        fetchCategories();
      } else {
        setEditError(data.error || "Error");
      }
    } catch {
      setEditError("Error de conexión");
    }
  };

  const handleDelete = async (cat: Category) => {
    const count = cat._count?.products || 0;
    if (count > 0) {
      flash(`"${cat.name}" tiene ${count} producto${count !== 1 ? "s" : ""} — no se puede eliminar`, true);
      return;
    }
    if (!confirm(`¿Eliminar la categoría "${cat.name}"?`)) return;
    const res = await fetch(`/api/categories?id=${cat.id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      flash(`"${cat.name}" eliminada`);
      fetchCategories();
    } else {
      flash(data.error || "Error al eliminar", true);
    }
  };

  const moveCategory = async (cat: Category, dir: "up" | "down") => {
    const idx = categories.findIndex(c => c.id === cat.id);
    const swapWith = categories[idx + (dir === "up" ? -1 : 1)];
    if (!swapWith) return;
    // intercambiar órdenes
    await Promise.all([
      fetch("/api/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cat.id, name: cat.name, description: cat.description, order: swapWith.order }),
      }),
      fetch("/api/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: swapWith.id, name: swapWith.name, description: swapWith.description, order: cat.order }),
      }),
    ]);
    fetchCategories();
  };

  const maxOrder = Math.max(0, ...categories.map(c => c.order));

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[#F97316] mb-2">Ajustes</p>
        <h1 className="text-2xl font-bold text-main">Categorías</h1>
        <p className="text-muted mt-1">
          Organiza tu catálogo. Las categorías aparecen en la tienda y en los filtros del catálogo.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <span className="text-red-300 text-sm">{error}</span>
        </div>
      )}
      {okMsg && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-start gap-3">
          <Check className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
          <span className="text-green-300 text-sm">{okMsg}</span>
        </div>
      )}

      {/* NUEVA CATEGORÍA */}
      <Card>
        <h2 className="text-lg font-semibold text-main mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-[#F97316]" />
          Nueva categoría
        </h2>
        <form onSubmit={handleAddCategory} className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                id="new-cat-name"
                placeholder="Nombre de la categoría"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                maxLength={40}
              />
            </div>
            <Button type="submit" loading={loading} className="self-start">
              <Plus className="w-4 h-4 mr-1" /> Crear
            </Button>
          </div>
          <Input
            id="new-cat-desc"
            placeholder="Descripción (opcional) — se muestra en la tienda"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            maxLength={120}
          />
        </form>
      </Card>

      {/* LISTA DE CATEGORÍAS */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-main flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-[#F97316]" />
            Categorías existentes
          </h2>
          <span className="text-sm text-muted">
            {categories.length} categor{categories.length === 1 ? "ía" : "ías"}
          </span>
        </div>

        {categories.length === 0 ? (
          <div className="text-center py-10">
            <FolderTree className="w-10 h-10 text-dim mx-auto mb-3" />
            <p className="text-muted text-sm">No hay categorías todavía. Crea la primera arriba.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map((cat, idx) => {
              const products = cat._count?.products || 0;
              const isEditing = editingId === cat.id;
              return (
                <div
                  key={cat.id}
                  className={`border rounded-xl p-3.5 transition-colors ${
                    isEditing
                      ? "border-[rgba(249,115,22,0.5)] bg-accent-soft/50"
                      : "border-card bg-card2 hover:border-[rgba(249,115,22,0.35)]"
                  }`}
                >
                  {!isEditing ? (
                    <div className="flex items-center gap-3">
                      {/* icono con inicial */}
                      <div className="w-9 h-9 rounded-lg bg-accent-soft flex items-center justify-center flex-none">
                        <span className="text-accent font-bold text-sm">{cat.name.charAt(0).toUpperCase()}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-main truncate">{cat.name}</p>
                        <p className="text-xs text-muted truncate">
                          {cat.description || <span className="text-dim italic">sin descripción</span>}
                        </p>
                      </div>

                      {/* contador de productos */}
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold flex-none flex items-center gap-1 ${
                        products > 0 ? "bg-accent-soft text-accent" : "bg-[var(--hover-soft)] text-dim"
                      }`}>
                        <Package className="w-3 h-3" />
                        {products}
                      </span>

                      {/* orden */}
                      <div className="flex flex-col gap-0.5 flex-none">
                        <button
                          onClick={() => moveCategory(cat, "up")}
                          disabled={idx === 0}
                          className="p-0.5 text-muted hover:text-accent disabled:opacity-20"
                          title="Subir"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveCategory(cat, "down")}
                          disabled={idx === categories.length - 1}
                          className="p-0.5 text-muted hover:text-accent disabled:opacity-20"
                          title="Bajar"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* acciones */}
                      <div className="flex gap-1 flex-none">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(cat)} title="Editar">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <button
                          onClick={() => handleDelete(cat)}
                          disabled={products > 0}
                          className="p-2 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title={products > 0 ? `Tiene ${products} productos asignados` : "Eliminar"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* modo edición */
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-accent">
                        <Pencil className="w-4 h-4" /> Editando "{cat.name}"
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-soft mb-1">Nombre</label>
                          <input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            maxLength={40}
                            className="input-theme w-full px-3 py-2 border border-soft rounded-lg text-main focus-mdc text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-soft mb-1">Descripción</label>
                          <input
                            value={editDesc}
                            onChange={e => setEditDesc(e.target.value)}
                            maxLength={120}
                            className="input-theme w-full px-3 py-2 border border-soft rounded-lg text-main focus-mdc text-sm"
                          />
                        </div>
                      </div>
                      {editError && <p className="text-xs text-red-400">{editError}</p>}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(cat.id)}>
                          <Save className="w-3.5 h-3.5 mr-1" /> Guardar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit}>
                          <X className="w-3.5 h-3.5 mr-1" /> Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {categories.length > 0 && (
          <div className="mt-4 pt-4 border-t border-card flex items-start gap-2 text-xs text-dim">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              Las flechas reordenan cómo se muestran en la tienda. No puedes eliminar una categoría que tiene productos — primero reasígnalos.
            </span>
          </div>
        )}
      </Card>

      {/* INFO EMPRESA (existente) */}
      <Card>
        <h2 className="text-lg font-semibold text-main mb-4">Información de la Empresa</h2>
        <div className="space-y-4">
          <Input id="companyName" label="Nombre" defaultValue="MDC" readOnly />
          <Input id="companyEmail" label="Email de contacto" type="email" placeholder="contacto@mdc.com" />
          <Input id="companyPhone" label="Teléfono" type="tel" placeholder="(000) 000-0000" />
          <Button>
            <Save className="w-4 h-4 mr-2" />
            Guardar Cambios
          </Button>
        </div>
      </Card>
    </div>
  );
}