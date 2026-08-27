const dialog = document.querySelector('#image-dialog');
const dialogImage = document.querySelector('#dialog-image');
const dialogCaption = document.querySelector('#dialog-caption');
const closeButton = document.querySelector('.dialog-close');

for (const button of document.querySelectorAll('.screenshot-button')) {
  button.addEventListener('click', () => {
    const preview = button.querySelector('img');
    dialogImage.src = button.dataset.image;
    dialogImage.alt = preview.alt;
    dialogCaption.textContent = button.dataset.caption;
    dialog.showModal();
  });
}

closeButton.addEventListener('click', () => dialog.close());

dialog.addEventListener('click', event => {
  if (event.target === dialog) dialog.close();
});
