(function ($) {
  "use strict";

  function extensionOf(filename) {
    var parts = String(filename || "").toLowerCase().split(".");
    return parts.length > 1 ? parts.pop() : "";
  }

  $(function () {
    $(document).on("click", ".dance-moves-select-file", function (event) {
      event.preventDefault();
      var field = $(this).closest(".dance-moves-file-field");
      var allowed = String(field.data("allowed-extensions") || "").split(",").filter(Boolean);
      var frame = wp.media({
        title: "Choose timing file",
        button: { text: "Use timing file" },
        multiple: false
      });

      frame.on("select", function () {
        var attachment = frame.state().get("selection").first().toJSON();
        var extension = extensionOf(attachment.filename);
        if (allowed.indexOf(extension) === -1) {
          window.alert("Choose a ." + allowed.join(" or .") + " timing file.");
          return;
        }
        field.find("input[type=hidden]").val(attachment.id);
        field.find(".dance-moves-file-name").text(attachment.filename);
        field.find(".dance-moves-file-url").attr("href", attachment.url).prop("hidden", false);
        field.find(".dance-moves-clear-file").prop("hidden", false);
      });
      frame.open();
    });

    $(document).on("click", ".dance-moves-clear-file", function (event) {
      event.preventDefault();
      var field = $(this).closest(".dance-moves-file-field");
      field.find("input[type=hidden]").val("");
      field.find(".dance-moves-file-name").text("No file selected");
      field.find(".dance-moves-file-url").attr("href", "#").prop("hidden", true);
      $(this).prop("hidden", true);
    });
  });
}(jQuery));
