const $ = (selector) => document.querySelector(selector);
const photoInput = $("#photoInput");
const dialog = $("#orderDialog");
const selectedPhotos = [];
const prices = { "10x15": 200, "15x21": 400, "20x30": 800 };
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
$("#year").textContent = new Date().getFullYear();

function openOrder() {
  $("#orderMessage").textContent = "";
  if (!dialog.open) dialog.showModal();
}
["#headerUpload", "#heroUpload", "#sizesUpload", "#closingUpload"].forEach((selector) => {
  $(selector).addEventListener("click", openOrder);
});
$("#choosePhotos").addEventListener("click", () => photoInput.click());
$("#uploadDrop").addEventListener("click", (event) => {
  if (event.target.closest("button")) return;
  photoInput.click();
});
$("#uploadDrop").addEventListener("dragover", (event) => {
  event.preventDefault();
  $("#uploadDrop").classList.add("dragging");
});
$("#uploadDrop").addEventListener("dragleave", () => $("#uploadDrop").classList.remove("dragging"));
$("#uploadDrop").addEventListener("drop", (event) => {
  event.preventDefault();
  $("#uploadDrop").classList.remove("dragging");
  addFiles(event.dataTransfer.files);
});
photoInput.addEventListener("change", () => {
  addFiles(photoInput.files);
  photoInput.value = "";
});

function addFiles(fileList) {
  const files = Array.from(fileList || []);
  const allowed = files.filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type));
  const rejected = files.length - allowed.length;
  let added = 0;
  for (const file of allowed) {
    if (selectedPhotos.length >= 100) break;
    if (file.size > 15 * 1024 * 1024) continue;
    selectedPhotos.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()), file, url: URL.createObjectURL(file) });
    added++;
  }
  renderPhotos();
  if (rejected || added < files.length) {
    $("#orderMessage").textContent = "Alguns arquivos foram ignorados. Use JPG, PNG ou WEBP com até 15 MB por foto; limite de 100 fotos por pedido.";
  } else {
    $("#orderMessage").textContent = added ? "Fotos adicionadas. Confira o tamanho e o total do seu pedido." : "";
  }
}

function renderPhotos() {
  const container = $("#selectedPhotos");
  container.replaceChildren();
  for (const photo of selectedPhotos) {
    const item = document.createElement("div");
    item.className = "selected-photo";
    const image = document.createElement("img");
    image.src = photo.url;
    image.alt = photo.file.name;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", "Remover " + photo.file.name);
    remove.addEventListener("click", () => {
      const index = selectedPhotos.findIndex((entry) => entry.id === photo.id);
      if (index >= 0) {
        URL.revokeObjectURL(selectedPhotos[index].url);
        selectedPhotos.splice(index, 1);
      }
      renderPhotos();
    });
    item.append(image, remove);
    container.append(item);
  }
  const count = selectedPhotos.length;
  $("#photoCount").textContent = count + (count === 1 ? " foto selecionada" : " fotos selecionadas");
  $("#orderTotal").textContent = currency.format((prices[$("#printSize").value] || 0) * count / 100);
  $("#continueOrder").disabled = count === 0;
  $("#improvePreview").hidden = !$("#simulateImprove").checked || count === 0;
}
$("#printSize").addEventListener("change", renderPhotos);
$("#simulateImprove").addEventListener("change", () => {
  $("#improvePreview").hidden = !$("#simulateImprove").checked || selectedPhotos.length === 0;
  if ($("#simulateImprove").checked && selectedPhotos.length) {
    $("#orderMessage").textContent = "A melhoria é apenas uma demonstração visual. Nenhuma IA está processando suas imagens nesta versão.";
  }
});
$("#continueOrder").addEventListener("click", () => {
  if (!selectedPhotos.length) return;
  const size = $("#printSize").value;
  const totalCents = (prices[size] || 0) * selectedPhotos.length;
  const order = {
    number: "FO-DEMO-" + new Date().toISOString().replace(/\D/g, "").slice(0, 14),
    createdAt: new Date().toISOString(),
    status: "aguardando_simulacao",
    paymentMode: "simulation_only",
    printingEnabled: false,
    size,
    quantity: selectedPhotos.length,
    totalCents,
    photos: selectedPhotos.map(({ file }) => ({ name: file.name, size: file.size, type: file.type }))
  };
  try {
    const orders = JSON.parse(localStorage.getItem("fotoon_demo_orders") || "[]");
    orders.push(order);
    localStorage.setItem("fotoon_demo_orders", JSON.stringify(orders.slice(-20)));
  } catch (error) {
    console.warn("Não foi possível salvar o pedido de demonstração neste navegador.", error);
  }
  $("#orderMessage").classList.add("success");
  $("#orderMessage").textContent = "Pedido de demonstração criado: " + order.number + ". Total estimado: " + currency.format(totalCents / 100) + ". Nenhum pagamento foi realizado e nenhuma impressão será iniciada. Os arquivos não foram enviados para um servidor.";
  $("#continueOrder").textContent = "Pedido de demonstração criado ✓";
  $("#continueOrder").disabled = true;
  const previous = document.querySelector(".demo-order-details");
  if (previous) previous.remove();
  const details = document.createElement("p");
  details.className = "demo-order-details";
  details.style.cssText = "margin:12px 28px 0;padding:12px;background:#f2f8f1;border-radius:8px;color:#286b35;font-size:11px;line-height:1.6";
  details.textContent = "Status: aguardando simulação · Pagamento: desativado · Impressão: desativada. Feche esta janela para voltar à página inicial.";
  $("#orderMessage").before(details);
});
dialog.addEventListener("close", () => {
  $("#continueOrder").disabled = selectedPhotos.length === 0;
  $("#continueOrder").innerHTML = 'Continuar para simulação <span>↗</span>';
  $("#orderMessage").classList.remove("success");
  const details = document.querySelector(".demo-order-details");
  if (details) details.remove();
});