/* Editor-only repeatable song entries; native WP media controls remain the owner of attachment selection. */
(function ($) {
  'use strict';
  $(function () {
    const rows = $('[data-dance-moves-song-rows]');
    const mode = $('[data-dance-moves-song-mode]');
    if (!rows.length || !mode.length) return;
    const template = $('#dance-moves-song-template');
    const add = $('.dance-moves-add-song');
    const refresh = () => {
      const items = rows.children('[data-dance-moves-song-row]');
      rows.toggle(mode.val() === 'collection');
      add.toggle(mode.val() === 'collection');
      items.each(function (index) {
        $(this).find('input,textarea').each(function () {
          const original = $(this).attr('name');
          if (original) $(this).attr('name', original.replace(/dance_moves_songs\[(?:\d+|__INDEX__)\]/, 'dance_moves_songs['+index+']'));
        });
        $(this).children('legend').text('Song ' + (index + 1));
      });
      add.prop('disabled', items.length >= 24);
    };
    add.on('click', function (event) {
      event.preventDefault();
      if (rows.children('[data-dance-moves-song-row]').length >= 24) return;
      const i = rows.children('[data-dance-moves-song-row]').length;
      const html = template.html().replaceAll('__INDEX__', String(i));
      rows.append(html);
      refresh();
    });
    rows.on('click','.dance-moves-remove-song',function (event) {
      event.preventDefault();
      $(this).closest('[data-dance-moves-song-row]').remove();
      refresh();
    });
    rows.on('click','.dance-moves-move-song-up,.dance-moves-move-song-down',function (event) {
      event.preventDefault();
      const row=$(this).closest('[data-dance-moves-song-row]');
      if ($(this).hasClass('dance-moves-move-song-up')) row.prev('[data-dance-moves-song-row]').before(row);
      else row.next('[data-dance-moves-song-row]').after(row);
      refresh();
    });
    mode.on('change',refresh);
    refresh();
  });
}(jQuery));
