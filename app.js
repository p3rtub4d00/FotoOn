const $ = (selector) => document.querySelector(selector);
const photoInput = $("#photoInput");
const dialog = $("#orderDialog");
const selectedPhotos = [];
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
let prices = { "10x15": 200, "15x21": 400, "20x30": 800 };
let deliveryFee = 0;
$("#year").textContent = new Date().getFullYear();

const customerFields = document.createElement("section");
customerFields.className = "customer-fields";
customerFields.innerHTML = `
  <h3>Seus dados</h3>
  <label>Nome completo<input id="customerName" autocomplete="name" maxlength="120" required placeholder="Como podemos chamar você?"></label>
  <label>WhatsApp / telefone<input id="customerPhone" autocomplete="tel" maxlength="30" required placeholder="(69) 99999-9999"></label>
  <label>Como deseja receber?
    <select id="fulfillment"><option value="pickup">Retirar no local</option><option value="delivery">Receber por entrega</option></select>
  </label>
  <label id="addressField" hidden>Endereço para entrega<input id="customerAddress" autocomplete="street-address" maxlength="300" placeholder="Rua, número, bairro e complemento"></label>
  <label>Observações (opcional)<textarea id="customerNotes" rows="2" maxlength="500" placeholder="Alguma orientação para o pedido?"></textarea></label>
`;
$(".order-controls").after(customerFields);
$("#fulfillment").addEventListener("change", () => {
  $("#addressField").hidden = $("#fulfillment").value !== "delivery";
  renderPhotos();
});
async function loadSettings() {
  try {
    const s = await fetch("/api/public-settings").then(r => r.json());
    prices = s.prices || prices; deliveryFee = s.deliveryFee || 0;
    const select = $("#printSize");
    select.innerHTML = "";
    for (const [value,label] of [["10x15","10 × 15 cm"],["15x21","15 × 21 cm"],["20x30","20 × 30 cm"]]) {
      const option = document.createElement("option");
      option.value = value; option.textContent = label + " — " + currency.format(prices[value] / 100) + " cada";
      select.append(option);
    }
    const fulfillment = $("#fulfillment");
    fulfillment.innerHTML = "";
    if (s.pickupEnabled) fulfillment.add(new Option("Retirar no local", "pickup"));
    if (s.deliveryEnabled) fulfillment.add(new Option("Receber por entrega", "delivery"));
    if (!fulfillment.options.length) fulfillment.add(new Option("Indisponível", ""));
    $("#addressField").hidden = fulfillment.value !== "delivery";
    renderPhotos();
  } catch (e) { console.warn("Não foi possível carregar preços do servidor.", e); }
}
function openOrder() {
  $("#orderMessage").textContent = "";
  if (!dialog.open) dialog.showModal();
}
["#headerUpload", "#heroUpload", "#sizesUpload", "#closingUpload", "#cartButton"].forEach(selector => {
  $(selector).addEventListener("click", openOrder);
});
$("#choosePhotos").addEventListener("click", () => photoInput.click());
$("#uploadDrop").addEventListener("click", event => {
  if (!event.target.closest("button")) photoInput.click();
});
$("#uploadDrop").addEventListener("dragover", event => { event.preventDefault(); $("#uploadDrop").classList.add("dragging"); });
$("#uploadDrop").addEventListener("dragleave", () => $("#uploadDrop").classList.remove("dragging"));
$("#uploadDrop").addEventListener("drop", event => { event.preventDefault(); $("#uploadDrop").classList.remove("dragging"); addFiles(event.dataTransfer.files); });
photoInput.addEventListener("change", () => { addFiles(photoInput.files); photoInput.value = ""; });
function addFiles(fileList) {
  const files = Array.from(fileList || []);
  let added = 0;
  for (const file of files) {
    if (!["image/jpeg","image/png","image/webp"].includes(file.type) || file.size > 15*1024*1024 || selectedPhotos.length >= 100) continue;
    selectedPhotos.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()), file, url: URL.createObjectURL(file) }); added++;
  }
  renderPhotos();
  $("#orderMessage").textContent = added ? "Fotos adicionadas. Confira seus dados e o total." : "Arquivos não aceitos. Use JPG, PNG ou WEBP de até 15 MB; máximo de 100 fotos.";
}
function renderPhotos() {
  const container=$("#selectedPhotos"); container.replaceChildren();
  for (const photo of selectedPhotos) {
    const item=document.createElement("div"); item.className="selected-photo";
    const image=document.createElement("img"); image.src=photo.url; image.alt=photo.file.name;
    const remove=document.createElement("button"); remove.type="button"; remove.textContent="×"; remove.setAttribute("aria-label","Remover "+photo.file.name);
    remove.addEventListener("click",()=>{const i=selectedPhotos.findIndex(x=>x.id===photo.id);if(i>=0){URL.revokeObjectURL(selectedPhotos[i].url);selectedPhotos.splice(i,1)}renderPhotos()});
    item.append(image,remove);container.append(item);
  }
  const count=selectedPhotos.length;
  $("#photoCount").textContent=count+(count===1?" foto selecionada":" fotos selecionadas");
  const subtotal=(prices[$("#printSize").value]||0)*count;
  const delivery=$("#fulfillment").value==="delivery"?deliveryFee:0;
  $("#orderTotal").textContent=currency.format((subtotal+delivery)/100);
  $("#continueOrder").disabled=count===0;
  $("#improvePreview").hidden=!$("#simulateImprove").checked||count===0;
  const note=$(".order-summary small");
  if(note) note.textContent="Pagamento em simulação · Impressão desativada"+(delivery?" · Entrega: "+currency.format(delivery/100):"");
}
$("#printSize").addEventListener("change",renderPhotos);
$("#simulateImprove").addEventListener("change",()=>{$("#improvePreview").hidden=!$("#simulateImprove").checked||!selectedPhotos.length;if($("#simulateImprove").checked)$("#orderMessage").textContent="A melhoria por IA ainda não está disponível nesta versão."});
$("#continueOrder").addEventListener("click",async()=>{
  if(!selectedPhotos.length)return;
  const name=$("#customerName").value.trim(),phone=$("#customerPhone").value.trim();
  if(!name||!phone){$("#orderMessage").textContent="Preencha seu nome e telefone.";return}
  if($("#fulfillment").value==="delivery"&&!$("#customerAddress").value.trim()){ $("#orderMessage").textContent="Informe o endereço para entrega.";return}
  const data=new FormData();
  data.append("customerName",name);data.append("phone",phone);data.append("size",$("#printSize").value);
  data.append("fulfillment",$("#fulfillment").value);data.append("address",$("#customerAddress").value);
  data.append("notes",$("#customerNotes").value);
  selectedPhotos.forEach(p=>data.append("photos",p.file,p.file.name));
  $("#continueOrder").disabled=true;$("#continueOrder").textContent="Enviando pedido...";
  try{
    const response=await fetch("/api/orders",{method:"POST",body:data});const result=await response.json();
    if(!response.ok)throw new Error(result.error||"Não foi possível criar o pedido.");
    $("#orderMessage").classList.add("success");
    $("#orderMessage").textContent="Pedido "+result.order.number+" registrado! Total: "+currency.format(result.order.totalCents/100)+".";
    const pay=document.createElement("button");pay.type="button";pay.className="button-primary";pay.style.cssText="margin:8px 28px 24px;width:calc(100% - 56px)";
    pay.textContent="Simular confirmação de pagamento";
    pay.addEventListener("click",async()=>{pay.disabled=true;try{const r=await fetch("/api/orders/"+result.order.id+"/simulate-payment",{method:"POST"});const d=await r.json();if(!r.ok)throw new Error(d.error);pay.textContent="Pagamento simulado ✓";$("#orderMessage").textContent="Pagamento apenas simulado. Nenhuma cobrança foi feita e nenhuma impressão será iniciada."}catch(e){pay.disabled=false;$("#orderMessage").textContent=e.message}});
    $(".dialog-submit").after(pay);
    $("#continueOrder").textContent="Pedido registrado ✓";
  }catch(error){$("#orderMessage").textContent=error.message;$("#continueOrder").disabled=false;$("#continueOrder").textContent="Tentar novamente ↗"}
});
dialog.addEventListener("close",()=>{
  $("#continueOrder").disabled=selectedPhotos.length===0;$("#continueOrder").innerHTML='Continuar para simulação <span>↗</span>';
  const pay=$(".dialog-submit + button");if(pay)pay.remove();
  $("#orderMessage").classList.remove("success");
});
loadSettings();