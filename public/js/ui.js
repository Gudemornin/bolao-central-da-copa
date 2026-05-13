let toastTimer

export function showToast(msg, type = 'green'){
  const t = document.getElementById('toast')

  if(!t) return

  t.textContent = msg
  t.className = `show ${type}`

  clearTimeout(toastTimer)

  toastTimer = setTimeout(() => {
    t.classList.remove('show')
  }, 3000)
}

export function toggleSidebar(){
  document.getElementById('sidebar')
    ?.classList.toggle('open')

  document.getElementById('sidebarOverlay')
    ?.classList.toggle('show')
}

export function openModal(id){
  document.getElementById(id)
    ?.classList.add('open')
}

export function closeModal(id){
  document.getElementById(id)
    ?.classList.remove('open')
}

export function initModalClosers(){
  document
    .querySelectorAll('.modal-overlay')
    .forEach(m => {
      m.addEventListener('click', e => {
        if(e.target === m){
          m.classList.remove('open')
        }
      })
    })
}

window.openModal = openModal
window.closeModal = closeModal
window.toggleSidebar = toggleSidebar