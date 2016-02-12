<?php
/**
 * @package SODAH-SPHERICAL-VIEWER
 * @version 1.16.02.11
 */
/*
Plugin Name: SODAH SPHERICAL VIEWER
Plugin URI: http://www.sodah.de
Description: Responsive html5 photo sphere viewer
Author: Sodah
Version: 1.16.02.11
Author URI: http://www.sodah.de
*/
function sodah_sphericalviewer_head() {
?> 
<link href="<?php echo plugin_dir_url(__FILE__); ?>css/sodah-spherical-viewer.css" rel="stylesheet">
<?php
} 

function sodah_sphericalviewer_menu() {    
    add_menu_page(__('Spherical Viewer'), __('Spherical Viewer'), 'administrator', __FILE__, 'sodah_sphericalviewer_settings_page',plugins_url('/img/sodahsphericalviewer.png', __FILE__));    
}

function sodah_sphericalviewer_settings_page(){
  
?>
<div class="wrap">
    <div id="icon-options-general" class="icon32"></div>
    <h2>Sodah Spherical Viewer</h2> 
    <div style="height: 20px">
        <div class="updated_custom" id="message_custom001" style="display: none;">&nbsp;</div>
    </div>
    <div id="dashboard-widgets-wrap">
        <div id="dashboard-widgets" class="metabox-holder">
            <div id="postbox-container-1" class="postbox-container" style="width:100%;">
                <div id="normal-sortables" class="meta-box-sortables ui-sortable">
                    <div class="postbox">
                        <h3 style="cursor: default"><span>Responsive html5 photo sphere viewer.</span></h3>

                        <div class="inside">
                            <div>
                                <p>                                    
                                    Sodah Spherical Viewer is a JavaScript library which renders 360° panoramas shots with Photo Sphere, the new camera mode of Android 4.2 Jelly Bean and above. 
                                </p>
                                <p>
                                    Photo Sphere Viewer is pure JS and based on Three.js, allowing very good performances on WebGL enabled systems (most recent browsers) and reasonably good performances on other systems supporting HTML Canvas.
                                </p>
                                <h3>
                                	Features
                                </h3>
                                <ul style="list-style: circle; margin-left:30px;">
                                	<li>Extreme easy to deploy</li>
                                	<li>Responsive</li>
                                	<li>Vector based for high density displays</li>
                                	<li>Customizable size and colors</li>
                                	<li>Draggable image on all directions</li>
                                	<li>Coded using CSS3 for animations instead of laggy javascript</li>
                                </ul>
                                <h3>
                                	Platforms and Browsers
                                </h3>
                                <ul style="list-style: circle; margin-left:30px;">
                                	<li>Windows: Firefox, Chrome, Opera, Safari, IE9, IE10+</li>
                                	<li>OSX: Safari, Firefox, Chrome, Opera</li>
                                	<li>iOS: Mobile Safari: iPad, iPhone, iPod Touch</li>
                                	<li>Android 2.3+: Chrome, Firefox, Opera and most other mobile browsers</li>
                                	<li>Blackberry: OS 7 Phone Browser, PlayBook Browser</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div class="postbox ">                            
                        <h3 style="cursor: default"><span><?php echo 'General Settings';?></span></h3>
                        
                        <div class="inside">
                            <table>
                            	 <tr>
                                    <td colspan="2">
                                        <label>Theme</label>
                                    </td>
                                    <td>
                                        <select class="sodahsphericalviewershortcode" id="theme" name="theme">
                                            <option value="light">light</option>
                                            <option value="dark">dark</option>
                                        </select>                                        
                                    </td>
                                </tr>
                            </table>
                        </div>
                    </div>

                    <div class="postbox ">                            
                        <h3 style="cursor: default"><span>Photo Settings</span></h3>
                        
                        <div class="inside">
                            <table style="width: 100%">
                                <tr>
                                    <td style="width: 20%;">
                                        <label>JPG</label>
                                    </td>
                                    <td style="width:80%">
                                        <input style="width:100%" class="sodahsphericalviewershortcode" type="text" id="jpg" name="jpg" placeholder="http://your image url here" />
                                    </td>
                                </tr>
                            </table>
                        </div>
                    </div>

                    <div class="postbox ">                            
                        <h3 style="cursor: default"><span><?php echo 'Generated shortcode';?></span></h3>
                        <div class="inside">
                            <textarea style="width: 100%; min-height:70px; font-size: 11px" id="matrix_shortcode" name="matrix_shortcode" readonly="readonly">[sodah-sphericalviewer]</textarea>   
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
<script type="text/javascript">
jQuery(document).ready(function(){    
    jQuery(".sodahsphericalviewershortcode").live('change',function(){        
      sodahsphericalviewer_shortcodegenerator();    
    });
    sodahsphericalviewer_shortcodegenerator = function () {
        var nfrtheme = jQuery("#theme").val();
        var nfrjpg = jQuery("#jpg").val();
        jQuery("#matrix_shortcode").val("[sodah-sphericalviewer theme='"+ nfrtheme +"' jpg='"+ nfrjpg + "']");      
    }
    jQuery('#matrix_shortcode').click(function() {
        jQuery(this).select();
    });
    sodahsphericalviewer_shortcodegenerator();
});
</script>

<?php
}

function sodah_sphericalviewer_shortcode($atts=array()){	
  global $post;
  global $data;

  //defaults
  $jpg = "";
  $theme = "";
  
  if(isset($atts['theme'])){
      $theme = $atts['theme'];
  }
  if(isset($atts['jpg'])){
      $jpg = $atts['jpg'];
  }
  $id = rand();
  $content1 = "
	  	<div class='sodahsphericalviewer' data-theme='".$theme."' id='wp".$id."' data-jpg='".$jpg."'  data-id='wp".$id."'>
	  	</div>
  ";

	wp_reset_query();
	return $content1;
}

function sodah_sphericalviewer_footer() {
  	if(!wp_script_is('jquery')) { //MISSING?
  		wp_enqueue_script('jquery',"//ajax.googleapis.com/ajax/libs/jquery/1.11.1/jquery.min.js");   
  	}
  	if(!wp_script_is('threejs')) {//MISSING?
  		wp_enqueue_script('threejs',plugin_dir_url(__FILE__)."js/three.min.js");
	}
	if(!wp_script_is('sodahsphericalviewer')) {//MISSING?
  		wp_enqueue_script('sodahsphericalviewer',plugin_dir_url(__FILE__)."js/sodah-spherical-viewer.js");
	}
	if(wp_script_is('threejs') && wp_script_is('sodahsphericalviewer')) {
  ?>
  <script type="text/javascript">
      jQuery(document).ready(function($) {
      	try {
      		$('.sodahsphericalviewer').each(function() {
		      		new SodahSphericalViewer({
						    panorama: $(this).data("jpg"),
                container: $(this).data("id"),
                navbar: true,
                anim_speed: '-2rpm',
                loading_img: '<?php echo plugin_dir_url(__FILE__);?>css/spinner.gif',
                time_anim: 500,
                theme: $(this).data("theme")
					     });
	      	});
	   } catch (e){
	   		//error
	   }
      });
  </script>
  <?php
	}
}
add_action('admin_menu', 'sodah_sphericalviewer_menu');
add_action( 'wp_head', 'sodah_sphericalviewer_head'); 
add_action( 'wp_footer', 'sodah_sphericalviewer_footer'); 
add_shortcode("sodah-sphericalviewer", "sodah_sphericalviewer_shortcode");
?>