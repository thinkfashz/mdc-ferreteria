"use client";

import { useEffect, useState } from "react";
import { Image, Plus, Trash2, GripVertical, Upload } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import type { Banner } from "@/types";

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    imageUrl: "",
    link: "",
    order: "0",
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const res = await fetch("/api/banners");
      const data = await res.json();
      setBanners(data);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        setForm({ ...form, imageUrl: data.url });
      }
    } catch (err) {
      alert("Error al subir imagen");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.imageUrl) {
      alert("Sube una imagen primero");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setModalOpen(false);
        setForm({ title: "", subtitle: "", imageUrl: "", link: "", order: "0" });
        fetchBanners();
      } else {
        const data = await res.json();
        alert(data.error || "Error");
      }
    } catch {
      alert("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este banner?")) return;
    try {
      await fetch(`/api/banners?id=${id}`, { method: "DELETE" });
      fetchBanners();
    } catch (err) {
      console.error("Error:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-[#FF6600] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banners</h1>
          <p className="text-gray-500 mt-1">Gestiona las imágenes de portada</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Banner
        </Button>
      </div>

      {banners.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12">
          <Image className="w-12 h-12 text-gray-300 mb-4" />
          <p className="text-gray-500">No hay banners creados</p>
          <Button onClick={() => setModalOpen(true)} className="mt-4">
            Crear primer banner
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {banners.map((banner) => (
            <Card key={banner.id} className="overflow-hidden">
              <img
                src={banner.imageUrl}
                alt={banner.title}
                className="w-full h-48 object-cover rounded-lg mb-3"
              />
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{banner.title}</h3>
                  {banner.subtitle && (
                    <p className="text-sm text-gray-500">{banner.subtitle}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">Orden: {banner.order}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(banner.id)}
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo Banner">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="title"
            label="Título *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            placeholder="Título del banner"
          />

          <Input
            id="subtitle"
            label="Subtítulo"
            value={form.subtitle}
            onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
            placeholder="Descripción opcional"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Imagen *
            </label>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#FF6600] transition-colors">
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-sm text-gray-500">
                {uploading ? "Subiendo..." : "Click para subir imagen"}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
            {form.imageUrl && (
              <img
                src={form.imageUrl}
                alt="Preview"
                className="mt-2 w-full h-32 object-cover rounded-lg"
              />
            )}
          </div>

          <Input
            id="link"
            label="Enlace (opcional)"
            value={form.link}
            onChange={(e) => setForm({ ...form, link: e.target.value })}
            placeholder="https://..."
          />

          <Input
            id="order"
            label="Orden"
            type="number"
            value={form.order}
            onChange={(e) => setForm({ ...form, order: e.target.value })}
          />

          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1" loading={submitting}>
              Crear Banner
            </Button>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
